import { type NextApiRequest, type NextApiResponse } from "next";
import { z } from "zod";

import { e, edgedbClient } from "~/server/edgedb";

const INPUT_SCHEMA = z.object({
  authorSlug: z.string().nonempty(),
  bookSlug: z.string().nonempty(),
  pageCount: z.coerce.number().int().positive(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { query } = req;
  const input = INPUT_SCHEMA.parse(query);

  const authorSlug = "the-author";

  const book = {
    slug: input.bookSlug,
    title: input.bookSlug.replaceAll("-", " ").toUpperCase(),
  };

  const pages = Array.from({ length: input.pageCount }, (_, i) =>
    BigInt(i + 1)
  ).map((number) => ({
    number,
    content: `page ${number} content at ${new Date().toISOString()}`,
  }));

  const ensureAuthor = e
    .insert(e.User, {
      slug: authorSlug,
    })
    .unlessConflict();

  await ensureAuthor.run(edgedbClient);

  const upsertPages = e.params(
    {
      pages: e.array(e.tuple({ number: e.bigint, content: e.str })),
    },
    (params) => {
      const upsertBook = e.assert_single(
        { message: "more than one book found after upsert" },
        e.assert_exists(
          { message: "no book found after upsert" },
          e.op(
            e
              .insert(e.Book, {
                ...book,
                author: e.assert_exists(
                  { message: "no author found" },
                  e.select(e.User, (userRef) => ({
                    filter_single: e.op(userRef.slug, "=", authorSlug),
                  }))
                ),
              })
              .unlessConflict(),
            "union",
            e.update(e.Book, (bookRef) => ({
              set: { ...book },
              filter: e.op(
                e.op(bookRef.author.slug, "=", authorSlug),
                "and",
                e.op(bookRef.slug, "=", book.slug)
              ),
            }))
          )
        )
      );

      const paramsForUpdateLoop = e.for(e.array_unpack(params.pages), (page) =>
        e.select(e.BookPage, (pageRef) => ({
          pageParams: page,
          filter: e.op(
            e.op(pageRef.book.id, "=", upsertBook.id),
            "and",
            e.op(pageRef.number, "=", page.number)
          ),
        }))
      ).pageParams;

      const paramsForInsertLoop = e.for(e.array_unpack(params.pages), (page) =>
        e.select({
          pageParams: page,
          filter: e.op(page, "not in", paramsForUpdateLoop),
        })
      ).pageParams;

      const insertPages = e.for(paramsForInsertLoop, (page) =>
        e.insert(e.BookPage, {
          book: upsertBook,
          number: page.number,
          content: page.content,
        })
      );

      const updatePages = e.op(
        "distinct",
        e.for(paramsForUpdateLoop, (page) =>
          e.update(e.BookPage, (pageRef) => ({
            set: { content: page.content },
            filter: e.op(
              e.op(pageRef.book.id, "=", upsertBook.id),
              "and",
              e.op(pageRef.number, "=", page.number)
            ),
          }))
        )
      );

      const deletePages = e.delete(e.BookPage, (pageRef) => ({
        filter: e.op(
          e.op(pageRef.book.id, "=", upsertBook.id),
          "and",
          e.op(pageRef.number, "not in", e.array_unpack(params.pages).number)
        ),
      }));

      return e.with(
        [
          upsertBook,
          paramsForUpdateLoop,
          paramsForInsertLoop,
          updatePages,
          insertPages,
          deletePages,
        ],
        e.select({
          book: upsertBook,
          paramsForUpdateLoop: paramsForUpdateLoop,
          paramsForInsertLoop: paramsForInsertLoop,
          updatePages: updatePages,
          insertPages: insertPages,
          deletePages: deletePages,
        })
      );
    }
  );

  // eslint-disable-next-line no-console
  console.log(upsertPages.toEdgeQL());

  const result = await upsertPages.run(edgedbClient, { pages });
  // eslint-disable-next-line no-console
  console.log(result);

  res.json({
    ...result,
    paramsForUpdateLoop: result.paramsForUpdateLoop.map((params) => ({
      ...params,
      number: Number(params.number),
    })),
    paramsForInsertLoop: result.paramsForInsertLoop.map((params) => ({
      ...params,
      number: Number(params.number),
    })),
  });
}

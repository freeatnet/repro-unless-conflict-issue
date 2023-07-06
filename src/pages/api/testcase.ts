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
    () => {
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

      return e.with(
        [upsertBook],
        e.select({
          book: upsertBook,
        })
      );
    }
  );

  // eslint-disable-next-line no-console
  console.log(upsertPages.toEdgeQL());

  const result = await upsertPages.run(edgedbClient, { pages });
  // eslint-disable-next-line no-console
  console.log(result);

  res.json(result);
}

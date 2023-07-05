import { type NextApiRequest, type NextApiResponse } from "next";

import { e, edgedbClient } from "~/server/edgedb";

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  const authorSlug = "the-author";

  const book = {
    slug: "test",
    title: "test",
  };

  const pages = Array.from({ length: 12 }, (_, i) => BigInt(i + 1)).map(
    (number) => ({
      number,
    })
  );

  const ensureAuthor = e
    .insert(e.User, {
      slug: authorSlug,
    })
    .unlessConflict();

  await ensureAuthor.run(edgedbClient);

  const upsertPages = e.params(
    {
      pages: e.array(e.tuple({ number: e.bigint })),
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

      return e.with(
        [upsertBook],
        e.for(e.array_unpack(params.pages), (page) =>
          e
            .insert(e.BookPage, {
              book: upsertBook,
              number: page.number,
            })
            .unlessConflict()
        )
      );
    }
  );

  const result = await upsertPages.run(edgedbClient, { pages });

  res.json(result);
}

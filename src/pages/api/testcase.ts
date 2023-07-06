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

  const ensureAuthor = e
    .insert(e.User, {
      slug: authorSlug,
    })
    .unlessConflict();

  await ensureAuthor.run(edgedbClient);

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

  // eslint-disable-next-line no-console
  console.log(upsertBook.toEdgeQL());

  /* Sample generated query:

    std::assert_single(((INSERT default::Book {
      slug := "foo-bar-75",
      title := "FOO BAR 75",
      author := (
        std::assert_exists(std::assert_single((WITH
          __scope_0_defaultUser := DETACHED default::User
        SELECT __scope_0_defaultUser {
          id
        }
        FILTER (__scope_0_defaultUser.slug = "the-author"))), message := "no author found")
      )
    }
    UNLESS CONFLICT) union (WITH
      __scope_1_defaultBook := DETACHED default::Book
    UPDATE __scope_1_defaultBook
    FILTER ((__scope_1_defaultBook.author.slug = "the-author") and (__scope_1_defaultBook.slug = "foo-bar-75"))
    SET {
      slug := "foo-bar-75",
      title := "FOO BAR 75"
    })), message := "more than one book found after upsert")

  */

  const result = await upsertBook.run(edgedbClient);
  // Expected: { id: "..." }
  // Observed: null if insert succeeds, { id: "..." } if update succeeds

  // eslint-disable-next-line no-console
  console.log(result);

  res.json(result);
}

module default {
  type User {
    required property slug -> str {
      constraint regexp(r'^[a-z0-9][a-z0-9-]*$');
      constraint exclusive;
    };
  }

  abstract type UserOwnedSluggable {
    required link author -> User {
      on target delete delete source;
    };

    required property slug -> str {
      constraint regexp(r'^[a-z0-9][a-z0-9-]*$');
    };

    constraint exclusive on ((.author, str_lower(.slug)));
  }

  type Book extending UserOwnedSluggable {
    required property title -> str;
    property description -> str;
    # ... some more props

    property updateCount -> int64 {
      default := 0;
    };

    multi link pages := .<book[is BookPage];
  }

  type BookPage {
    required link book -> Book {
      on target delete delete source;
    };
    required property number -> bigint;

    # ... some content properties
    property content -> str;

    constraint exclusive on ((.book, .number));
  }
}

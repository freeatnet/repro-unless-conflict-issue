CREATE MIGRATION m1au5xome7uciay6af5ygtuqewusdkk63wrgxryzj3zhktxvz6umna
    ONTO initial
{
  CREATE FUTURE nonrecursive_access_policies;
  CREATE TYPE default::User {
      CREATE REQUIRED PROPERTY slug -> std::str {
          CREATE CONSTRAINT std::regexp('^[a-z0-9][a-z0-9-]*$');
      };
  };
  CREATE ABSTRACT TYPE default::UserOwnedSluggable {
      CREATE REQUIRED LINK author -> default::User {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY slug -> std::str {
          CREATE CONSTRAINT std::regexp('^[a-z0-9][a-z0-9-]*$');
      };
      CREATE CONSTRAINT std::exclusive ON ((.author, std::str_lower(.slug)));
  };
  CREATE TYPE default::Book EXTENDING default::UserOwnedSluggable {
      CREATE PROPERTY description -> std::str;
      CREATE REQUIRED PROPERTY title -> std::str;
  };
  CREATE TYPE default::BookPage {
      CREATE REQUIRED LINK book -> default::Book {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY number -> std::bigint;
      CREATE CONSTRAINT std::exclusive ON ((.book, .number));
  };
  ALTER TYPE default::Book {
      CREATE MULTI LINK pages := (.<book[IS default::BookPage]);
  };
};

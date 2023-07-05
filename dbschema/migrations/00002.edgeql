CREATE MIGRATION m12i5f3as3ovc34kx65unpmztdrkvjyvbk5oiknivregiy52zl5ozq
    ONTO m1au5xome7uciay6af5ygtuqewusdkk63wrgxryzj3zhktxvz6umna
{
  ALTER TYPE default::User {
      ALTER PROPERTY slug {
          CREATE CONSTRAINT std::exclusive;
      };
  };
};

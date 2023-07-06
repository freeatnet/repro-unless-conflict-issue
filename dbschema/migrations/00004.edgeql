CREATE MIGRATION m14joczwaapzyjjferajuiktkx7npfuod6n5s6m77vzyfqnnusttpa
    ONTO m1ckrdeko562vxjr2ogbyin2hnt4dwadsagrhia5gmkryfoaaqtzeq
{
  ALTER TYPE default::Book {
      CREATE PROPERTY updateCount -> std::int64 {
          SET default := 0;
      };
  };
};

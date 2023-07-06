CREATE MIGRATION m1ckrdeko562vxjr2ogbyin2hnt4dwadsagrhia5gmkryfoaaqtzeq
    ONTO m12i5f3as3ovc34kx65unpmztdrkvjyvbk5oiknivregiy52zl5ozq
{
  ALTER TYPE default::BookPage {
      CREATE PROPERTY content -> std::str;
  };
};

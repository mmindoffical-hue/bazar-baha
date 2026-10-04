export const tk = {
  appName: 'Bazar Baha',
  navigationLabel: 'Esasy nawigasiýa',
  navigation: {
    home: 'Baş sahypa',
    search: 'Gözleg',
    basket: 'Sebedim',
    profile: 'Profil',
  },
  pageDescriptions: {
    home: 'Gündelik bazar bahalary',
    search: 'Gerekli harydyňyzy tapyň',
    basket: 'Satyn almaly harytlaryňyz',
    profile: 'Hasap we sazlamalar',
  },
  auth: {
    providerMissing: 'Hasap üpjünçisi tapylmady.',
    email: 'E-poçta',
    password: 'Açar sözi',
    signIn: 'Girmek',
    signUp: 'Hasap açmak',
    createAccount: 'Täze hasap açmak',
    haveAccount: 'Hasabyňyz barmy? Giriň',
    needAccount: 'Hasabyňyz ýokmy? Hasap açyň',
    signingIn: 'Girilýär...',
    signingUp: 'Hasap açylýar...',
    signOut: 'Çykyş',
    signedUp: 'Hasap üstünlikli açyldy.',
    emailConfirmation: 'Hasaby tassyklamak üçin e-poçtaňyza hat iberildi.',
    signedOut: 'Hasapdan çykmak başartmady.',
    loading: 'Hasap maglumatlary alynýar...',
    errors: {
      invalidCredentials: 'E-poçta ýa-da açar sözi nädogry.',
      emailRegistered: 'Bu e-poçta öň hasaba alnan. Giriň ýa-da başga e-poçta ulanyň.',
      weakPassword: 'Açar sözi gaty gysga ýa-da gowşak. Has uzyn we güýçli açar sözi giriziň.',
      invalidEmail: 'Dogry e-poçta salgysyny giriziň.',
      network: 'Internet birikmesini barlap, gaýtadan synanyşyň.',
      notConfigured: 'Giriş hyzmaty sazlanmandyr. Soňrak gaýtadan synanyşyň.',
      generic: 'Amal ýerine ýetmedi. Maglumatlary barlap, gaýtadan synanyşyň.',
    },
  },
  basketAuth: {
    title: 'Girmek gerek',
    description: 'Sebediňizi ulanmak üçin ilki hasabyňyza giriň.',
    goToProfile: 'Profile geçmek',
  },
  form: {
    submit: 'Dowam etmek',
    emailRequired: 'E-poçta salgysyny giriziň.',
    passwordRequired: 'Açar sözüni giriziň.',
  },
} as const

export type PageKey = keyof typeof tk.navigation
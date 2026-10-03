export const tk = {
  appName: 'Bazar Baha',
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
} as const

export type PageKey = keyof typeof tk.navigation
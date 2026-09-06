// Центральная конфигурация сайта.
// Всё, что нужно поменять «под себя», собрано здесь.

export const SITE = {
  url: 'https://shubin.vc',
  title: 'Ник Шубин — о стартапах, продукте и ИИ',
  shortTitle: 'Ник Шубин',
  description:
    'Личный блог предпринимателя и инвестора Ника Шубина: стартапы, продукт, искусственный интеллект и венчур — с цифрами, таблицами и без воды.',
  lang: 'ru',
  locale: 'ru_RU',
} as const;

export const AUTHOR = {
  name: 'Ник Шубин',
  nameEn: 'Nick Shubin',
  role: 'Предприниматель и инвестор',
  bio: 'Строю технологические компании и инвестирую в ранние стадии. Пишу о том, что проверил на собственных деньгах и ошибках.',
  email: 'hi@shubin.vc',
  // sameAs-профили — важны для Schema.org Person и GEO (единый граф автора).
  socials: [
    { label: 'Telegram', url: 'https://t.me/nickshubin' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/nickshubin' },
    { label: 'X', url: 'https://x.com/nickshubin' },
    { label: 'GitHub', url: 'https://github.com/nickshubin' },
  ],
} as const;

// Подписка: Buttondown (double opt-in, экспорт базы, RSS-to-email).
// Замените `shubinvc` на свой username после регистрации — больше ничего менять не нужно.
export const NEWSLETTER = {
  provider: 'buttondown',
  action: 'https://buttondown.com/api/emails/embed-subscribe/shubinvc',
  name: 'Письмо Шубина',
  pitch: 'Одно письмо в неделю: разборы стартапов, цифры и выводы, которые я не публикую в соцсетях.',
} as const;

// Навигация шапки.
export const NAV = [
  { label: 'Блог', href: '/blog' },
  { label: 'Исследования', href: '/research' },
  { label: 'Рассылка', href: '/newsletter' },
  { label: 'О Нике', href: '/about' },
] as const;

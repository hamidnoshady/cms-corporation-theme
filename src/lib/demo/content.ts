import type {
  Block,
  FormDoc,
  LinkData,
  Locale,
  PageDoc,
  RichText,
  SiteDescriptor,
  Snapshot,
  SlotKey,
} from '../cms/types';
/** Tenant sample content, never a fallback for a broken/missing CMS page. */
const text = (value: string, type = 'paragraph', tag?: string) => ({
  type,
  ...(tag ? { tag } : {}),
  children: [{ type: 'text', text: value }],
});
export const rich = (title: string, body?: string, tag = 'h2'): RichText => ({
  root: { type: 'root', children: [text(title, 'heading', tag), ...(body ? [text(body)] : [])] },
});
const link = (label: string, url: string, appearance: 'default' | 'outline' = 'default') => ({
  link: { type: 'custom', label, url, appearance } satisfies LinkData,
});
const pos = {
  id: 'sample-pos',
  url: '/demo/pos-reference.webp',
  width: 1500,
  height: 1000,
  alt: 'Biza Miz POS product reference with a sample café menu; not a live sales report.',
};
const orders = {
  id: 'sample-orders',
  url: '/demo/orders-reference.webp',
  width: 1440,
  height: 900,
  alt: 'Biza Miz order queue reference in an empty sample workspace.',
};
export function demoSnapshot(locale: Locale): Snapshot {
  const fa = locale === 'fa';
  const tx = (f: string, e: string) => (fa ? f : e);
  const site: SiteDescriptor = {
    contractVersion: 1,
    domain: 'localhost:3000',
    name: tx('بیزامیز', 'Biza Miz'),
    slug: 'biza-miz',
    type: 'business',
    status: 'active',
    defaultLocale: 'fa',
    availableLocales: ['fa', 'en'],
    blocks: [
      'content',
      'mediaBlock',
      'features',
      'cta',
      'faq',
      'pricing',
      'testimonials',
      'contact',
      'formBlock',
      'logos',
      'gallery',
      'team',
      'archive',
    ],
    theme: { radius: 'md', lineHeight: 1.8 },
    branding: {
      displayName: tx('بیزامیز', 'Biza Miz'),
      tagline: tx('ابزارهای روزمره، برای مهمان‌نوازی بهتر.', 'Everyday tools. Better hospitality.'),
    },
    themeRuntime: {
      theme: { key: 'apex' },
      settings: {
        ctaPrimaryLabelFa: 'شروع با یک دمو',
        ctaPrimaryLabelEn: 'Get started',
        ctaPrimaryHref: '/demo',
        ctaSecondaryLabelFa: 'نمای محصول',
        ctaSecondaryLabelEn: 'View product',
        ctaSecondaryHref: '#product',
        heroEyebrowFa: 'برای رستوران‌ها و کافه‌ها',
        heroEyebrowEn: 'Made for restaurants & cafés',
        productCaptionFa:
          'تصویر مرجع محصول با منوی نمونه؛ دادهٔ فروش زنده نیست و ظاهر نسخهٔ جاری ممکن است متفاوت باشد.',
        productCaptionEn:
          'Product reference with a sample menu. Not live sales data; the current release may look different.',
        defaultTheme: 'system',
        showFooterLocaleSwitcher: true,
        footerNoteFa: 'از منو تا پایان شیفت؛ یک گفت‌وگو برای پیدا کردن مسیر مناسب کسب‌وکار شما.',
        footerNoteEn:
          'From the first order to closing time. Start a conversation about the right fit for your venue.',
      },
      bindings: Object.fromEntries(
        ['home', 'features', 'restaurants', 'pricing', 'demo', 'privacy'].map((key) => [
          key,
          { id: `sample-${key}`, type: 'page', slug: key },
        ]),
      ),
    },
  };
  const featureItems = [
    {
      title: tx('منوی شما، نقطهٔ شروع', 'Start with your menu'),
      description: tx(
        'در دمو، دسته‌بندی‌ها و آیتم‌های منوی خود را مرور کنید و مسیر ثبت سفارش را ببینید.',
        'Walk through your categories and menu items, then follow an order through the point of sale.',
      ),
    },
    {
      title: tx('میز، سفارش، سرویس', 'Keep service in view'),
      description: tx(
        'سناریوی حضوری یا بیرون‌بر کسب‌وکار خود را بررسی کنید؛ از انتخاب میز تا پیگیری سفارش.',
        'Explore your dine-in or takeaway workflow, from choosing a table to following an order.',
      ),
    },
    {
      title: tx('پرداخت و رسید', 'Close the loop'),
      description: tx(
        'روش دریافت وجه و صدور رسید را با دستگاه و چاپگر واقعی خود، پیش از راه‌اندازی بررسی کنید.',
        'Check payment recording and receipt printing on your actual devices before going live.',
      ),
    },
    {
      title: tx('پایان شیفت، تصویر روشن‌تر', 'Make sense of the shift'),
      description: tx(
        'گزارش سفارش‌ها و فروش را در دموی اختصاصی مرور کنید و نیازهای تیم خود را مطرح کنید.',
        'Review orders and sales reporting in your guided demo and discuss what your team needs.',
      ),
    },
  ];
  const workflow: Block = {
    blockType: 'features',
    heading: tx('از اولین سفارش تا پایان شیفت.', 'From the first order to closing time.'),
    intro: tx(
      'یک مسیر مشخص برای کارهایی که هر روز تکرار می‌کنید.',
      'A clear path through the work you do every day.',
    ),
    columns: '4',
    items: featureItems,
  };
  const faq: Block = {
    blockType: 'faq',
    heading: tx('پیش از شروع، بدانید.', 'A few things before you start.'),
    items: [
      {
        question: tx('دمو چگونه برگزار می‌شود؟', 'What happens in the demo?'),
        answer: tx(
          'نوع کسب‌وکار و اطلاعات تماس خود را بفرستید. تیم فروش برای هماهنگی زمان و مرور منو، سفارش، پرداخت، رسید و گزارش با شما تماس می‌گیرد.',
          'Share your venue type and contact details. Sales can arrange a walkthrough of menu, orders, payments, receipts and reporting around your needs.',
        ),
      },
      {
        question: tx(
          'آیا شارژ کیف پول همان هزینهٔ لایسنس است؟',
          'Is wallet funding a licence fee?',
        ),
        answer: tx(
          'خیر. شارژ کیف پول با هزینهٔ استفاده یا راه‌اندازی یکسان نیست. تعرفه‌ها، شرایط و هزینه‌های قابل‌اعمال باید پیش از فعال‌سازی در بیزامیز تأیید شوند.',
          'No. A wallet top-up is distinct from usage or setup charges. Confirm applicable rates, terms and charges in Biza Miz before approving activation.',
        ),
      },
      {
        question: tx(
          'اگر اینترنت یا چاپگر مشکل داشته باشد چه؟',
          'What about connectivity and printers?',
        ),
        answer: tx(
          'اتصال و دستگاه‌های محل باید در دمو بررسی شوند. قابلیت آفلاین یا سازگاری چاپگر را بدون آزمون عملی فرض نکنید؛ دربارهٔ روش جایگزین زمان اختلال گفت‌وگو کنید.',
          'Test venue connectivity and devices in the demo. Do not assume offline operation or printer compatibility without a practical test; discuss an outage contingency.',
        ),
      },
      {
        question: tx('ثبت‌نام و پرداخت کجا انجام می‌شود؟', 'Where do signup and payments happen?'),
        answer: tx(
          'حساب مالک، فعال‌سازی، کیف پول و پرداخت فقط در بیزامیز انجام می‌شوند. این وب‌سایت برای معرفی و درخواست دمو است.',
          'Owner accounts, activation, wallet funding and payment stay in Biza Miz. This website is for information and demo requests.',
        ),
      },
    ],
  };
  const cta: Block = {
    blockType: 'cta',
    richText: rich(
      tx('با منوی خودتان شروع کنیم.', 'Let’s start with your menu.'),
      tx(
        'دربارهٔ رستوران یا کافهٔ خود بگویید؛ مسیر مناسب را با هم بررسی می‌کنیم.',
        'Tell us about your restaurant or café. We’ll explore the right workflow together.',
      ),
    ),
    links: [link(tx('درخواست دموی اختصاصی', 'Request a guided demo'), '/demo')],
  };
  const pricingIntro: Block = {
    blockType: 'content',
    columns: [
      {
        size: 'half',
        richText: rich(
          tx('اول مسیر کار، بعد تصمیم.', 'The workflow first. The decision second.'),
          tx(
            'راه‌اندازی و آموزش را متناسب با منو، تیم، دستگاه‌ها و شرایط اتصال محل بررسی کنید.',
            'Discuss setup and training around your menu, team, devices and venue connectivity.',
          ),
        ),
      },
      {
        size: 'half',
        richText: rich(
          tx('قیمت روشن، پیش از فعال‌سازی.', 'Clear pricing before activation.'),
          tx(
            'تعرفهٔ جاری، هزینهٔ راه‌اندازی و افزونه‌ها را پیش از تأیید دریافت کنید. شارژ کیف پول به معنی استفادهٔ نامحدود نیست.',
            'Ask for current rates, setup costs and add-ons before approving anything. Funding a wallet does not mean unlimited use.',
          ),
        ),
        enableLink: true,
        link: link(tx('دربارهٔ قیمت‌گذاری', 'How pricing works'), '/pricing', 'outline').link,
      },
    ],
  };
  const industries: Block = {
    blockType: 'content',
    columns: [
      {
        size: 'half',
        richText: rich(
          tx('برای ریتم رستوران شما.', 'For your restaurant’s rhythm.'),
          tx(
            'سرویس حضوری، میزها و سفارش‌های هم‌زمان را در سناریویی نزدیک به کار واقعی خود مرور کنید. گزینه‌های موردنیاز باید در دمو تأیید شوند.',
            'Explore dine-in service, tables and concurrent orders using a scenario close to your operation. Confirm the options you need during the demo.',
          ),
        ),
        enableLink: true,
        link: link(tx('رستوران و کافه', 'Restaurants & cafés'), '/restaurants').link,
      },
      {
        size: 'half',
        richText: rich(
          tx('برای جزئیات کافهٔ شما.', 'For the details of your café.'),
          tx(
            'از منوی نوشیدنی تا رسید نهایی، جریان کار پیشخوان را با تیم خود بررسی کنید.',
            'From the drinks menu to the final receipt, walk through counter service with your team.',
          ),
        ),
        enableLink: true,
        link: link(tx('بررسی ویژگی‌ها', 'Explore the workflow'), '/features').link,
      },
    ],
  };
  const page = (
    key: SlotKey,
    title: string,
    description: string,
    layout: Block[],
    heroTitle = title,
    media = false,
  ): PageDoc => ({
    id: `sample-${key}`,
    slug: key,
    title,
    _status: 'published',
    meta: { title, description, image: pos },
    hero: {
      type: key === 'home' ? 'highImpact' : 'lowImpact',
      richText: rich(heroTitle, description, 'h1'),
      links:
        key === 'demo' || key === 'privacy'
          ? []
          : [
              link(tx('شروع با یک دمو', 'Get started'), '/demo'),
              link(
                tx('نمای محصول', 'View product'),
                key === 'home' ? '#product' : '/features',
                'outline',
              ),
            ],
      ...(media ? { media: pos } : {}),
    },
    layout,
  });
  const pages: Snapshot['pages'] = {
    home: page(
      'home',
      tx('صندوق و مدیریت سفارش رستوران و کافه', 'POS for restaurants & cafés'),
      tx(
        'منو، میز، سفارش، پرداخت و گزارش شیفت. بیزامیز را با سناریوی واقعی کسب‌وکار خود بشناسید.',
        'Menu, tables, orders, payments and shift reports. Explore Biza Miz around the way your venue works.',
      ),
      [workflow, industries, pricingIntro, faq, cta],
      tx('سرویس بهتر.\nاز اولین سفارش.', 'Better service.\nFrom the first order.'),
      true,
    ),
    features: page(
      'features',
      tx('ویژگی‌ها و جریان کار', 'One shift. A connected workflow.'),
      tx(
        'چیزی که در دمو بررسی می‌کنیم: از تعریف منو تا بستن سفارش و مرور گزارش‌ها.',
        'What we’ll explore in the demo: from building a menu to closing orders and reviewing reports.',
      ),
      [
        workflow,
        {
          blockType: 'mediaBlock',
          media: orders,
          caption: rich(
            tx('نمای صف سفارش در فضای نمونه', 'Order queue in a sample workspace'),
            tx(
              'این تصویر با دادهٔ نمونه ثبت شده و اثبات آمادگی همهٔ قابلیت‌ها نیست.',
              'This reference capture uses sample data and does not certify release readiness.',
            ),
            'h3',
          ),
        },
        faq,
        cta,
      ],
    ),
    restaurants: page(
      'restaurants',
      tx('رستوران‌ها و کافه‌ها', 'Built around hospitality.'),
      tx(
        'منوی شما، تیم شما، روش سرویس شما. یک دموی هدفمند برای انتخاب آگاهانه.',
        'Your menu, your team, your service style. A focused demo for an informed decision.',
      ),
      [
        industries,
        workflow,
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: rich(
                tx('برای یک دموی مفید چه آماده کنیم؟', 'Make the demo useful.'),
                tx(
                  'نمونهٔ منو، تعداد میزها، نقش اعضای تیم، مدل چاپگر و وضعیت اینترنت را آماده کنید. سازگاری و شرایط اجرا باید پیش از شروع واقعی تأیید شوند.',
                  'Bring a sample menu, your table layout, staff roles, printer model and connectivity details. Verify device compatibility and operating conditions before going live.',
                ),
              ),
            },
          ],
        },
        faq,
        cta,
      ],
    ),
    pricing: page(
      'pricing',
      tx('قیمت‌گذاری، بدون ابهام', 'Know what you’re approving.'),
      tx(
        'تعرفهٔ جاری و هزینه‌های قابل‌اعمال را پیش از فعال‌سازی بررسی کنید. این سایت کیف پول یا درگاه پرداخت ندارد.',
        'Review current rates and applicable charges before activation. This site does not operate a wallet or take payments.',
      ),
      [pricingIntro, faq, cta],
    ),
    demo: page(
      'demo',
      tx('بیایید دربارهٔ کسب‌وکار شما صحبت کنیم.', 'Let’s talk about your venue.'),
      tx(
        'اطلاعات لازم برای هماهنگی یک دموی مرتبط را وارد کنید. در پیش‌نمایش بدون اتصال فروش، هیچ درخواستی ثبت نمی‌شود.',
        'Share the details needed to arrange a relevant demo. In an unconnected preview, no request is submitted.',
      ),
      [],
    ),
    privacy: page(
      'privacy',
      tx('حریم خصوصی در پیش‌نمایش', 'Privacy in this preview'),
      tx(
        'این متن نمونهٔ پوسته است، نه سیاست حقوقی نهایی یک کسب‌وکار.',
        'This is theme sample content, not a business’s final legal policy.',
      ),
      [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: rich(
                tx('اطلاعات فرم و آمار', 'Form data and analytics'),
                tx(
                  'در حالت متصل، اطلاعات تماس فقط با رضایت شما برای پیگیری درخواست به سامانهٔ فروش ارسال می‌شود. آمار اختیاری است و اطلاعات تماس در آن ارسال نمی‌شود. پیش از انتشار، مالک سایت باید سیاست واقعی، مدت نگهداری و راه تماس برای درخواست حذف را در CMS منتشر کند.',
                  'When connected, contact information is sent to the sales system only with your consent to follow up. Analytics is optional and excludes contact details. Before launch, the site owner must publish the actual policy, retention period and deletion-request contact through the CMS.',
                ),
              ),
            },
          ],
        },
      ],
    ),
  };
  const form: FormDoc | null = null;
  return {
    site,
    pages,
    form,
    locale,
    preview: false,
    demo: true,
    productMedia: pos,
    header: [
      link(tx('محصول', 'Product'), '/features'),
      link(tx('رستوران و کافه', 'Restaurants & cafés'), '/restaurants'),
      link(tx('قیمت‌گذاری', 'Pricing'), '/pricing'),
    ],
    footer: [
      link(tx('ویژگی‌ها', 'Features'), '/features'),
      link(tx('رستوران و کافه', 'Restaurants & cafés'), '/restaurants'),
      link(tx('قیمت‌گذاری', 'Pricing'), '/pricing'),
      link(tx('درخواست دمو', 'Request demo'), '/demo'),
      link(tx('حریم خصوصی', 'Privacy'), '/privacy'),
    ],
  };
}

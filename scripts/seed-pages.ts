// pnpm seed:pages — writes the five static pages (tr + en).
//
// Mirrors src/lib/pages/actions.ts: content is authored as a TipTap doc and run
// through deriveContent, so contentHtml and contentJson can never drift apart.
// Writing raw HTML here would leave the admin editor showing an empty document
// and silently blanking the page on its next save.
//
// Idempotent: re-running overwrites the same key+locale rows. It cannot call
// revalidateTag (no request context), so pages served from cache refresh on the
// next deploy or after one save from /admin/pages.
//
// `--sql` prints the upserts instead of applying them. The production image
// carries no scripts/ and no devDependencies, so this file cannot run on the
// server; piping the SQL into the db container is the way in:
//
//   pnpm seed:pages --sql | ssh user@host \
//     "cd /opt/stacks/<stack> && docker compose -f compose.yml -f compose.nginx.yml \
//      exec -T db psql -U kb -d <database>"
import "dotenv/config";
import type { JSONContent } from "@tiptap/core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { pages } from "../src/lib/db/schema";
import { deriveContent } from "../src/lib/content/derive";
import { SITE_AUTHOR, SITE_CONTACT_EMAIL } from "../src/lib/site/config";

type Locale = "tr" | "en";
type PageKey = "about" | "contact" | "privacy" | "cookies" | "disclosure";

const h = (level: number, text: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const p = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const ul = (items: string[]): JSONContent => ({
  type: "bulletList",
  content: items.map((text) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  })),
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

const CONTACT_EMAIL = SITE_CONTACT_EMAIL || "hello@example.com";

const CONTENT: Record<PageKey, Record<Locale, { title: string; body: JSONContent }>> = {
  about: {
    tr: {
      title: "Hakkında",
      body: doc(
        p(`Merhaba, ben ${SITE_AUTHOR}. Yazılım yazıyorum ve öğrendiklerimi burada tutuyorum.`),
        p(
          "Bu blog bir yayın organı değil, bir defter. Bir problemi çözerken öğrendiğim şeyi yazıyorum; çünkü yazmadığım şeyleri altı ay sonra hatırlamadığımı fark ettim. Bazen bir hata ayıklama seansının notu oluyor, bazen bir kararın neden öyle verildiğinin kaydı.",
        ),
        h(2, "Burada ne var"),
        ul([
          "Yazılım: üzerinde çalıştığım şeyler, karşılaştığım hatalar, işe yarayan ve yaramayan çözümler.",
          "İş: ürün kararları, teknik borç, küçük bir ekiple çalışmanın gerçekleri.",
          "Öğrendiklerim: kitaplar, araçlar, alışkanlıklar — ve çoğu zaman neyi yanlış bildiğim.",
        ]),
        h(2, "Yazma biçimim"),
        p(
          "Kısa tutmaya çalışıyorum. Bir konuyu tam anlamadıysam bunu yazıda söylüyorum; kesin konuşup sonra düzeltmektense baştan belirsizliği kabul etmeyi tercih ediyorum. Eski yazıları da silmiyorum — yanıldığım yerler kaldığı gibi duruyor.",
        ),
        p(
          "Bir şey yanlışsa ya da eklemek istediğin bir şey varsa yazmaktan çekinme. Düzeltmeler için minnettarım.",
        ),
      ),
    },
    en: {
      title: "About",
      body: doc(
        p(`Hi, I'm ${SITE_AUTHOR}. I build software and keep notes here about what I learn doing it.`),
        p(
          "This blog is a notebook, not a publication. I write down what I worked out while solving a problem, because I noticed I don't remember the things I don't write. Sometimes it's the record of a debugging session, sometimes the reasoning behind a decision.",
        ),
        h(2, "What's here"),
        ul([
          "Software: what I'm building, the bugs I hit, what worked and what didn't.",
          "Work: product decisions, technical debt, the reality of a small team.",
          "Learning: books, tools, habits — and most often, what I had wrong.",
        ]),
        h(2, "How I write"),
        p(
          "I try to keep it short. If I don't fully understand something, I say so in the post; I'd rather admit the uncertainty than sound certain and correct it later. I don't delete old posts either — the places I was wrong stay where they are.",
        ),
        p("If something is wrong or you want to add to it, get in touch. Corrections are welcome."),
      ),
    },
  },

  contact: {
    tr: {
      title: "İletişim",
      body: doc(
        p("Soru, düzeltme, öneri ya da sadece merhaba demek için e-posta yazabilirsin."),
        p(CONTACT_EMAIL),
        p(
          "Genellikle birkaç gün içinde dönüyorum. Yazdıklarımdan birinde hata bulduysan özellikle duymak isterim — düzeltip yazının altına not düşüyorum.",
        ),
        h(2, "İş birlikleri"),
        p(
          "Sponsorlu içerik ya da ücretli bağlantı yayımlamıyorum. Bir ürün veya araç hakkında yazıyorsam kendi paramla aldığım ya da kendi işimde kullandığım içindir.",
        ),
      ),
    },
    en: {
      title: "Contact",
      body: doc(
        p("Email me with a question, a correction, a suggestion, or just to say hello."),
        p(CONTACT_EMAIL),
        p(
          "I usually reply within a few days. If you found a mistake in something I wrote, I especially want to hear it — I fix it and note the correction at the bottom of the post.",
        ),
        h(2, "Working together"),
        p(
          "I don't publish sponsored posts or paid links. If I write about a product or a tool, it's because I paid for it or use it in my own work.",
        ),
      ),
    },
  },

  privacy: {
    tr: {
      title: "Gizlilik Politikası",
      body: doc(
        p(
          "Bu site kişisel bir blogdur ve mümkün olduğunca az veri toplar. Aşağıda ne topladığımı, neden topladığımı ve ne kadar sakladığımı olduğu gibi yazdım.",
        ),
        h(2, "Hesap açmıyorsun"),
        p(
          "Sitede üyelik, yorum ya da bülten yok. Okumak için hiçbir şey vermene gerek yok ve senden isim, e-posta veya benzeri bir bilgi istenmiyor.",
        ),
        h(2, "Çerez tercihin"),
        p(
          "Reklam çerezleri için rızanı sorduğumda verdiğin cevabı kaydediyorum. Bu kayıt bilerek kaba tutuluyor: rastgele üretilmiş bir kimlik, cevabın (kabul/ret/kısmi), ülke kodun, cihazının mobil mi masaüstü mü olduğu ve politika sürümü. IP adresini ve tam tarayıcı bilgini saklamıyorum.",
        ),
        p(
          "Bunu tutmamın tek sebebi rızanın verildiğini kanıtlayabilmek — KVKK ve GDPR bunu gerektiriyor.",
        ),
        h(2, "Reklamlar"),
        p(
          "Sitede Google AdSense reklamları gösteriliyor. AdSense yalnızca sen kabul ettiğinde yükleniyor; reddedersen reklam betiği hiç çalışmıyor. Kabul edersen Google kendi çerezlerini kullanarak reklamları kişiselleştirebilir. Google'ın veri işleme koşulları kendi politikalarına tabidir.",
        ),
        h(2, "Analitik"),
        p("Google Analytics ya da benzeri bir izleme aracı kullanmıyorum."),
        h(2, "Sunucu kayıtları"),
        p(
          "Siteyi barındıran altyapı, her web sunucusu gibi teknik kayıtlar tutar. Bunlar hata ayıklama ve kötüye kullanımı önleme dışında bir amaçla kullanılmaz.",
        ),
        h(2, "Haklarının kapsamı"),
        p(
          "KVKK ve GDPR kapsamında kişisel verilerine erişme, düzeltilmesini veya silinmesini isteme hakkın var. Site senden kimlik bilgisi toplamadığı için elimde genellikle sana ait bir kayıt bulunmaz; yine de bir talebin varsa iletişim sayfasındaki adresten yazabilirsin.",
        ),
        h(2, "Değişiklikler"),
        p(
          "Bu metin değişirse rıza politikasının sürümü de değişir ve tercihin yeniden sorulur.",
        ),
      ),
    },
    en: {
      title: "Privacy Policy",
      body: doc(
        p(
          "This is a personal blog and it collects as little as it can. Below is what I collect, why, and for how long — stated plainly.",
        ),
        h(2, "There are no accounts"),
        p(
          "No sign-ups, no comments, no newsletter. You don't have to give anything to read, and you are never asked for a name, an email, or anything like it.",
        ),
        h(2, "Your cookie choice"),
        p(
          "When I ask for consent to advertising cookies, I record your answer. The record is deliberately coarse: a randomly generated id, your answer (granted, denied, or partial), your country code, whether the device is mobile or desktop, and the policy version. I do not store your IP address or your full browser string.",
        ),
        p(
          "The only reason I keep it is to be able to show that consent was given — KVKK and the GDPR require that.",
        ),
        h(2, "Advertising"),
        p(
          "The site shows Google AdSense ads. AdSense loads only if you accept; if you decline, the ad script never runs at all. If you accept, Google may use its own cookies to personalise ads. Google's handling of that data is governed by its own policies.",
        ),
        h(2, "Analytics"),
        p("I do not use Google Analytics or any similar tracking tool."),
        h(2, "Server logs"),
        p(
          "The infrastructure hosting this site keeps technical logs, as every web server does. They are not used for anything beyond debugging and preventing abuse.",
        ),
        h(2, "Your rights"),
        p(
          "Under KVKK and the GDPR you can ask to access, correct, or delete your personal data. Because the site collects nothing that identifies you, there is usually no record of you to produce — but if you have a request, write to the address on the contact page.",
        ),
        h(2, "Changes"),
        p("If this text changes, the consent policy version changes with it and you are asked again."),
      ),
    },
  },

  cookies: {
    tr: {
      title: "Çerez Politikası",
      body: doc(
        p("Bu sitede iki tür çerez var: çalışması için gerekenler ve reklam çerezleri."),
        h(2, "Gerekli çerezler"),
        p("Rıza tercihini hatırlamak için iki çerez kullanılıyor:"),
        ul([
          "kb_consent — verdiğin cevabı, politika sürümünü ve cevap zamanını tutar.",
          "kb_cid — rıza kaydını eşleştirmek için rastgele üretilmiş bir kimlik. Kim olduğunla ilgili hiçbir bilgi taşımaz.",
        ]),
        p(
          "Bu çerezler 180 gün saklanır. Süre dolduğunda ya da politika sürümü değiştiğinde tercihin yeniden sorulur.",
        ),
        h(2, "Reklam çerezleri"),
        p(
          "Google AdSense çerezleri yalnızca sen kabul ettikten sonra yerleştirilir. Reddedersen AdSense betiği sayfaya hiç eklenmez, dolayısıyla çerez de oluşmaz.",
        ),
        h(2, "Tercihini değiştirmek"),
        p(
          "Tarayıcının site ayarlarından bu sitenin çerezlerini silersen tercih sıfırlanır ve bir sonraki ziyarette yeniden sorulur.",
        ),
      ),
    },
    en: {
      title: "Cookie Policy",
      body: doc(
        p("This site uses two kinds of cookies: the ones it needs to work, and advertising cookies."),
        h(2, "Necessary cookies"),
        p("Two cookies remember your consent choice:"),
        ul([
          "kb_consent — your answer, the policy version, and when you answered.",
          "kb_cid — a randomly generated id used to match the consent record. It carries nothing about who you are.",
        ]),
        p(
          "These are kept for 180 days. When they expire, or when the policy version changes, you are asked again.",
        ),
        h(2, "Advertising cookies"),
        p(
          "Google AdSense cookies are only set after you accept. If you decline, the AdSense script is never added to the page, so no cookie is created.",
        ),
        h(2, "Changing your mind"),
        p(
          "Clearing this site's cookies in your browser settings resets the choice, and you'll be asked again on your next visit.",
        ),
      ),
    },
  },

  disclosure: {
    tr: {
      title: "Reklam ve Şeffaflık",
      body: doc(
        p(
          "Bu blog Google AdSense reklamlarıyla masraflarını karşılıyor. Reklamların ne olacağını ben seçmiyorum; Google seçiyor. Bir reklamda gördüğün ürünle bir ilişkim olduğu anlamına gelmez.",
        ),
        h(2, "Sponsorlu içerik yok"),
        p(
          "Para karşılığı yazı yayımlamıyorum, ücretli bağlantı satmıyorum ve bir ürün hakkında olumlu yazmam için ödeme kabul etmiyorum.",
        ),
        h(2, "Bahsettiğim ürünler"),
        p(
          "Bir araçtan ya da kitaptan söz ediyorsam ya kendi paramla aldığım ya da işimde kullandığım içindir. İleride bir bağlantıdan komisyon alırsam bunu ilgili yazının içinde açıkça belirteceğim.",
        ),
        h(2, "Yapay zekâ kullanımı"),
        p(
          "Yazıları ben yazıyorum. Taslak çıkarmak, düzeltmek ya da bir konuyu araştırmak için yapay zekâ araçlarından yararlandığım oluyor; ama yayımlanan her cümlenin sorumluluğu bana ait.",
        ),
        h(2, "Hatalar"),
        p(
          "Bir yazıda hata bulursam düzeltiyorum ve düzeltmeyi yazının altında not ediyorum. Yazıyı sessizce değiştirip yanılmamış gibi yapmıyorum.",
        ),
      ),
    },
    en: {
      title: "Advertising & Transparency",
      body: doc(
        p(
          "This blog covers its costs with Google AdSense. I don't choose which ads appear — Google does. Seeing a product in an ad here does not mean I have any relationship with it.",
        ),
        h(2, "No sponsored posts"),
        p(
          "I don't publish paid posts, I don't sell links, and I don't accept payment to write favourably about anything.",
        ),
        h(2, "Products I mention"),
        p(
          "If I mention a tool or a book, it's because I paid for it or use it in my work. If I ever earn a commission from a link, I'll say so plainly inside that post.",
        ),
        h(2, "Use of AI"),
        p(
          "I write the posts. I sometimes use AI tools to draft, edit, or research a topic — but every published sentence is mine to answer for.",
        ),
        h(2, "Corrections"),
        p(
          "When I find a mistake I fix it and note the correction at the bottom of the post. I don't quietly edit a post and pretend I was never wrong.",
        ),
      ),
    },
  },
};

/** Postgres literal — doubles single quotes, the only escape a text literal needs. */
const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;

async function emitSql() {
  const out: string[] = ["begin;"];
  for (const key of Object.keys(CONTENT) as PageKey[]) {
    for (const locale of ["tr", "en"] as Locale[]) {
      const { title, body } = CONTENT[key][locale];
      const d = await deriveContent(body, locale);
      out.push(
        `insert into pages (key, locale, title, content_json, content_html, updated_at) values (` +
          `${lit(key)}, ${lit(locale)}, ${lit(title)}, ${lit(JSON.stringify(d.contentJson))}::jsonb, ${lit(d.html)}, now())` +
          ` on conflict (key, locale) do update set title = excluded.title,` +
          ` content_json = excluded.content_json, content_html = excluded.content_html, updated_at = now();`,
      );
    }
  }
  out.push("commit;");
  process.stdout.write(out.join("\n") + "\n");
}

async function main() {
  if (process.argv.includes("--sql")) {
    await emitSql();
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  for (const key of Object.keys(CONTENT) as PageKey[]) {
    for (const locale of ["tr", "en"] as Locale[]) {
      const { title, body } = CONTENT[key][locale];
      const derived = await deriveContent(body, locale);
      await db
        .insert(pages)
        .values({
          key,
          locale,
          title,
          contentJson: derived.contentJson,
          contentHtml: derived.html,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [pages.key, pages.locale],
          set: {
            title,
            contentJson: derived.contentJson,
            contentHtml: derived.html,
            updatedAt: new Date(),
          },
        });
      console.log(`wrote ${key}/${locale} — ${derived.wordCount} words`);
    }
  }

  await pool.end();
  console.log("\nDone. Pages are cached by tag, so they refresh on the next deploy —");
  console.log("or immediately if you open /admin/pages and hit save once.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

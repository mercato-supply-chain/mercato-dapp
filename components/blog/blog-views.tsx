import Link from 'next/link'
import { BlogEndCta } from '@/components/blog/blog-end-cta'
import { BlogArticleBody } from '@/components/blog/blog-article-body'
import { BlogBreadcrumbs, BlogLayout } from '@/components/blog/blog-layout'
import { BlogPostCard } from '@/components/blog/blog-post-card'
import { BlogIndexExplorer, type BlogExplorerCopy } from '@/components/blog/blog-index-explorer'
import { Button } from '@/components/ui/button'
import { getAllBlogPosts } from '@/lib/blog/posts'
import { getBlogLocaleContent } from '@/lib/blog/content'
import { getServerLocale } from '@/lib/i18n/server'
import { ArrowRight } from 'lucide-react'

const COPY = {
  en: {
    title: 'Mercato Blog',
    tagline: 'Learn · Grow · Succeed',
    subtitle:
      'Plain-language guides on supply chain finance for PyMEs, suppliers, and investors — no crypto background required.',
    howItWorks: 'How Mercato works',
    openVault: 'Open Mercato vault',
    explorer: {
      tabs: { all: 'All', pyme: 'PyMEs', supplier: 'Suppliers', investor: 'Investors' },
      sections: {
        pyme: {
          title: 'For PyMEs',
          description:
            'Practical guides for buyers: create deals, understand purchase order financing, and how escrow protects your business.',
        },
        supplier: {
          title: 'For Suppliers',
          description:
            'For suppliers: set up your profile, showcase your products, and see how purchase order deals pay you.',
        },
        investor: {
          title: 'For Investors',
          description:
            'New to vaults and deals? Learn where yield comes from and how to put idle USDC to work between deals.',
        },
      },
      empty: 'No articles for this audience yet — check back soon.',
    } satisfies BlogExplorerCopy,
  },
  es: {
    title: 'Blog de Mercato',
    tagline: 'Aprende · Crece · Triunfa',
    subtitle:
      'Guías en lenguaje claro sobre financiamiento de cadena de suministro para PyMEs, proveedores e inversionistas.',
    howItWorks: 'Cómo funciona Mercato',
    openVault: 'Abrir vault de Mercato',
    explorer: {
      tabs: { all: 'Todas', pyme: 'PyMEs', supplier: 'Proveedores', investor: 'Inversionistas' },
      sections: {
        pyme: {
          title: 'Para PyMEs',
          description:
            'Guías prácticas para compradores: crea órdenes, entiende el financiamiento de órdenes de compra y cómo el escrow protege tu negocio.',
        },
        supplier: {
          title: 'Para proveedores',
          description:
            'Para proveedores: configura tu perfil, muestra tus productos y descubre cómo te pagan las órdenes de compra.',
        },
        investor: {
          title: 'Para inversionistas',
          description:
            '¿Nuevo en vaults y órdenes? Aprende de dónde sale el rendimiento y cómo poner a trabajar USDC ocioso entre órdenes.',
        },
      },
      empty: 'Aún no hay artículos para esta audiencia — vuelve pronto.',
    } satisfies BlogExplorerCopy,
  },
} as const

export async function BlogIndexView() {
  const locale = await getServerLocale()
  const copy = COPY[locale]
  const posts = getAllBlogPosts()

  return (
    <BlogLayout>
      <main className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
        <BlogBreadcrumbs items={[{ label: 'Home', href: '/' }, { label: copy.title }]} />

        <div className="mb-12 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            {copy.tagline}
          </p>
          <h1 className="font-display text-4xl font-normal tracking-tight sm:text-5xl">{copy.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{copy.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              <Link href="/dashboard/vault">
                {copy.openVault}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/how-it-works">{copy.howItWorks}</Link>
            </Button>
          </div>
        </div>

        <BlogIndexExplorer posts={posts} locale={locale} copy={copy.explorer} />

        <BlogEndCta audience="all" />
      </main>
    </BlogLayout>
  )
}

export async function BlogPostView({ slug }: { slug: string }) {
  const locale = await getServerLocale()
  const posts = getAllBlogPosts()
  const post = posts.find((item) => item.slug === slug)
  if (!post) return null

  const content = getBlogLocaleContent(post, locale)
  const related = posts.filter((item) => item.slug !== slug).slice(0, 2)

  return (
    <BlogLayout>
      <main className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <BlogBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: locale === 'es' ? 'Blog' : 'Blog', href: '/blog' },
            { label: content.title },
          ]}
        />

        <header className="mb-10 border-b border-border/60 pb-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            {post.category === 'vault' ? 'Vault guide' : 'Mercato guide'}
          </p>
          <h1 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">{content.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{content.excerpt}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span aria-hidden>·</span>
            <span>{post.readingTimeMinutes} min read</span>
          </div>
        </header>

        <BlogArticleBody sections={content.sections} />

        <BlogEndCta audience={post.audience} />

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-5 font-display text-2xl font-normal tracking-tight">Continue reading</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {related.map((item) => (
                <BlogPostCard key={item.slug} post={item} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </main>
    </BlogLayout>
  )
}

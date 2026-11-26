import { notFound } from 'next/navigation'
import { BlogPostView } from '@/components/blog/blog-views'
import { JsonLd } from '@/components/seo/json-ld'
import { getBlogPost, getBlogPostSlugs } from '@/lib/blog/posts'
import { getBlogLocaleContent } from '@/lib/blog/content'
import { languageAlternates } from '@/lib/i18n/config'
import { getServerLocale } from '@/lib/i18n/server'

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getBlogPostSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return {}

  const locale = await getServerLocale()
  const content = getBlogLocaleContent(post, locale)

  return {
    title: content.title,
    description: content.description,
    keywords: post.tags,
    openGraph: {
      title: content.title,
      description: content.description,
      url: `https://mercato.app/blog/${slug}`,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
    },
    alternates: {
      canonical: `/blog/${slug}`,
      languages: languageAlternates(`/blog/${slug}`),
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const locale = await getServerLocale()
  const content = getBlogLocaleContent(post, locale)

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: content.title,
    description: content.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { '@type': 'Organization', name: 'Mercato' },
    publisher: { '@type': 'Organization', name: 'Mercato' },
    mainEntityOfPage: `https://mercato.app/blog/${slug}`,
    keywords: post.tags.join(', '),
  }

  const faqSection = content.sections.find((section) => section.type === 'faq')
  const faqSchema =
    faqSection && faqSection.type === 'faq'
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqSection.items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }
      : null

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://mercato.app' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://mercato.app/blog' },
      {
        '@type': 'ListItem',
        position: 3,
        name: content.title,
        item: `https://mercato.app/blog/${slug}`,
      },
    ],
  }

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      <BlogPostView slug={slug} />
    </>
  )
}

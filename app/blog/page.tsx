import { BlogIndexView } from '@/components/blog/blog-views'
import { JsonLd } from '@/components/seo/json-ld'
import { getAllBlogPosts } from '@/lib/blog/posts'
import { getBlogLocaleContent } from '@/lib/blog/content'
import { getServerLocale } from '@/lib/i18n/server'

export async function generateMetadata() {
  return {
    title: 'Blog | Mercato — Supply Chain Finance Guides',
    description:
      'Educational guides on supply chain finance, purchase order deals, and the Mercato platform — for PyMEs, suppliers, and investors.',
    openGraph: {
      title: 'Mercato Blog',
      description:
        'Educational guides on supply chain finance, purchase order deals, and the Mercato platform — for PyMEs, suppliers, and investors.',
      url: 'https://mercato.app/blog',
      type: 'website',
    },
    alternates: {
      canonical: '/blog',
      languages: {
        en: '/blog?lang=en',
        es: '/blog?lang=es',
      },
    },
  }
}

export default async function BlogPage() {
  const locale = await getServerLocale()
  const posts = getAllBlogPosts()

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Mercato Blog',
    description:
      'Educational guides on supply chain finance, purchase order deals, and the Mercato platform — for PyMEs, suppliers, and investors.',
    url: 'https://mercato.app/blog',
    publisher: { '@type': 'Organization', name: 'Mercato' },
    blogPost: posts.map((post) => {
      const content = getBlogLocaleContent(post, locale)
      return {
        '@type': 'BlogPosting',
        headline: content.title,
        description: content.description,
        datePublished: post.publishedAt,
        url: `https://mercato.app/blog/${post.slug}`,
      }
    }),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://mercato.app' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://mercato.app/blog' },
    ],
  }

  return (
    <>
      <JsonLd data={blogSchema} />
      <JsonLd data={breadcrumbSchema} />
      <BlogIndexView />
    </>
  )
}

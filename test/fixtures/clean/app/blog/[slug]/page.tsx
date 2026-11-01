export async function generateMetadata({ params }) { const { slug } = await params; return pageMetadata({ path: `/blog/${slug}`, title: slug, description: "" }); }

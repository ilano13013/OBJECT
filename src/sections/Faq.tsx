import { Plus } from 'lucide-react'

const QUESTIONS = [
  {
    q: 'Do I need to know how to code?',
    a: 'No. You fill in fields, upload files and choose from presets. The preview updates as you type, and publishing is a single button.',
  },
  {
    q: 'Can I use a simple photo?',
    a: 'Yes. In Photo Motion mode your images are animated with depth, parallax and light effects. It is still a 2D image, and we never present a photo as a 3D model. Studio subscribers can also generate a real 3D model from their photos with AI (up to 5 per month), to check before publishing.',
  },
  {
    q: 'Can I import a 3D model?',
    a: 'Yes. True 3D mode accepts GLB and glTF files up to 50 MB. Your visitors can rotate the real model. Models are treated as data only: scripts, cameras and lights inside the file are ignored.',
  },
  {
    q: 'How do I share my showroom?',
    a: 'Every published showroom gets a public link. Copy it into your Instagram bio, a newsletter, a QR code on packaging, or link to it from your own site.',
  },
  {
    q: 'Can I edit a published showroom?',
    a: 'Yes. Edit the draft, then republish. The link stays the same. You can also unpublish at any time: the link stops working until you publish again.',
  },
  {
    q: 'How does the subscription work?',
    a: 'Studio costs 29 € per month and covers several showrooms within your quota. You can cancel from the billing portal at any time: your showrooms stay live until the end of the paid period and your drafts are kept.',
  },
]

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="gutter grid gap-12 py-28 md:grid-cols-12 md:py-40">
      <h2 id="faq-title" className="display text-[clamp(2.4rem,6vw,5.5rem)] md:col-span-12">
        Fair <span className="text-silver">questions.</span>
      </h2>
      <div className="md:col-span-7 md:col-start-6">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="group border-b border-hairline [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-medium text-porcelain transition-colors hover:text-lime md:text-xl">
              {q}
              <Plus aria-hidden className="size-5 shrink-0 transition-transform duration-500 ease-out-expo group-open:rotate-45" />
            </summary>
            <p className="max-w-[60ch] pb-8 leading-relaxed text-silver">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

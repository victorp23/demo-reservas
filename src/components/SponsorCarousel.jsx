export function SponsorCarousel({ sponsors }) {
  if (!sponsors.length) return null

  const sponsorLoop = [...sponsors, ...sponsors, ...sponsors]

  return <section className="sponsor-section" aria-label="Auspiciantes">
    <div className="sponsor-heading"><p className="eyebrow dark">AUSPICIANTES</p><h2>Marcas que nos acompañan</h2></div>
    <div className="sponsor-marquee">
      <div className="sponsor-fade sponsor-fade-left" />
      <div className="sponsor-fade sponsor-fade-right" />
      <div className="sponsor-track">
        {sponsorLoop.map((sponsor, index) => {
          const content = <><div className="sponsor-logo"><img src={sponsor.logoUrl} alt={sponsor.name} loading="lazy" /></div><div className="sponsor-info"><strong>{sponsor.name}</strong>{sponsor.category && <span>{sponsor.category}</span>}</div></>
          return sponsor.linkUrl ? <a className="sponsor-card" key={`${sponsor.id}-${index}`} href={sponsor.linkUrl} target="_blank" rel="noreferrer">{content}</a> : <article className="sponsor-card" key={`${sponsor.id}-${index}`}>{content}</article>
        })}
      </div>
    </div>
  </section>
}

import PillButton from "../components/PillButton";

const CARDS = [
  {
    title: "Logistics Guidelines",
    desc: "Best practices for logistics operations in NER",
    cta: "Download PDF",
    pdf: "/Policies-of-the-Logistics-Unit.pdf",
  },
  {
    title: "Emergency SOPs",
    desc: "Standard operating procedures for emergencies",
    cta: "Download PDF",
    pdf: "/emergency_sop_ner.pdf",
  },
  {
    title: "Driver Handbook",
    desc: "Safety guidelines for drivers",
    cta: "Download PDF",
    pdf: "/driver_handbook_ner.pdf",
  },
  {
    title: "Training Videos",
    desc: "Video tutorials and training sessions",
    cta: "Watch Now",
  },
  {
    title: "NER Road Atlas",
    desc: "Detailed road map and information",
    cta: "Download PDF",
    pdf: "/NER States Roadmap.pdf",
  },
  {
    title: "FAQs",
    desc: "Frequently asked questions",
    cta: "View FAQs",
    pdf: "/State_Road_Atlas_FAQs.pdf"
  },
];

export default function ResourcesPage({ c }) {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-1" style={{ color: c.text }}>
        Guidelines &amp; Resources
      </h1>
      <p className="mb-6" style={{ color: c.textMuted }}>
        Important documents, SOPs, and learning materials
      </p>

      <div className="grid md:grid-cols-3 gap-5">
        {CARDS.map((card) => (
          <div
            key={card.title}
            className="rounded-xl p-6 text-center flex flex-col items-center gap-3"
            style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
          >
            <div className="font-bold text-lg" style={{ color: c.text }}>
              {card.title}
            </div>
            <div className="text-sm" style={{ color: c.textMuted }}>
              {card.desc}
            </div>
            {card.pdf ? (
              <a href={card.pdf} download>
                <PillButton c={c}>{card.cta}</PillButton>
              </a>
            ) : (
              <PillButton c={c}>{card.cta}</PillButton>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


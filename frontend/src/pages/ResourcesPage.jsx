import Sidebar from "../components/Sidebar";
import PillButton from "../components/PillButton";

const SIDEBAR_ITEMS = [
  "Guidelines",
  "SOPs",
  "Training Material",
  "Videos",
  "Downloads",
  "FAQs",
];

const CARDS = [
  {
    title: "Logistics Guidelines",
    desc: "Best practices for logistics operations in NER",
    cta: "Download PDF",
  },
  {
    title: "Emergency SOPs",
    desc: "Standard operating procedures for emergencies",
    cta: "Download PDF",
  },
  {
    title: "Driver Handbook",
    desc: "Safety guidelines for drivers",
    cta: "Download PDF",
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
  },
  {
    title: "FAQs",
    desc: "Frequently asked questions",
    cta: "View FAQs",
  },
];

export default function ResourcesPage({ c, sub, setSub }) {
  return (
    <div className="flex">
      <Sidebar c={c} title="Resources" items={SIDEBAR_ITEMS} active={sub} setActive={setSub} />
      <div className="flex-1">
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
              <div className="font-bold" style={{ color: c.text }}>
                {card.title}
              </div>
              <div className="text-sm" style={{ color: c.textMuted }}>
                {card.desc}
              </div>
              <PillButton c={c}>{card.cta}</PillButton>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

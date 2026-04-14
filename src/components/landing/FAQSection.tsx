import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqData, l } from "./types";

interface FAQSectionProps {
  language: string;
}

export const FAQSection = ({ language }: FAQSectionProps) => (
  <section id="faq" className="section-pad" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 0%, rgba(100,85,240,.04) 50%, transparent 100%)", pointerEvents: "none" }} />
    <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <span className="section-label">{language === "ar" ? "الأسئلة الشائعة" : "FAQ"}</span>
        <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)" }}>
          <span className="grad-text">{language === "ar" ? "إجابات على أسئلتك" : "Got Questions?"}</span>
        </h2>
      </div>

      <Accordion type="single" collapsible>
        {faqData.map((faq, i) => (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className="faq-item"
            style={{ padding: "0 20px", marginBottom: 10, borderRadius: 16 }}
          >
            <AccordionTrigger style={{ fontSize: 15, fontWeight: 600, paddingTop: 18, paddingBottom: 18, color: "var(--kojo-text)" }}>
              {l(faq.q_en, faq.q_ar, language)}
            </AccordionTrigger>
            <AccordionContent style={{ color: "rgba(240,240,255,.5)", fontSize: 14, lineHeight: 1.7, paddingBottom: 18 }}>
              {l(faq.a_en, faq.a_ar, language)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

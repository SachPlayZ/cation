"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function LandingMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        gsap.set(
          ".motion-hero-copy > *, .motion-hero-visual, .motion-reveal, .motion-word, .motion-image, .motion-metric",
          { clearProps: "all" }
        );
        return;
      }

      gsap.from(".motion-hero-copy > *", {
        autoAlpha: 0,
        y: 22,
        duration: 0.9,
        stagger: 0.08,
        ease: "power3.out",
      });

      gsap.from(".motion-hero-visual", {
        autoAlpha: 0,
        scale: 0.94,
        duration: 1.15,
        delay: 0.12,
        ease: "power3.out",
      });

      gsap.utils.toArray<HTMLElement>(".motion-reveal").forEach((element) => {
        gsap.from(element, {
          autoAlpha: 0,
          y: 34,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 86%",
            toggleActions: "play none none reverse",
          },
        });
      });

      gsap.utils.toArray<HTMLElement>(".motion-copy").forEach((group) => {
        const words = group.querySelectorAll<HTMLElement>(".motion-word");

        gsap.fromTo(
          words,
          { autoAlpha: 0.14, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            stagger: 0.08,
            ease: "none",
            scrollTrigger: {
              trigger: group,
              start: "top 82%",
              end: "bottom 48%",
              scrub: 0.55,
            },
          }
        );
      });

      gsap.utils.toArray<HTMLElement>(".motion-image").forEach((image) => {
        gsap
          .timeline({
            scrollTrigger: {
              trigger: image,
              start: "top 94%",
              end: "bottom top",
              scrub: 0.75,
            },
          })
          .fromTo(
            image,
            { autoAlpha: 0.28, scale: 0.8 },
            { autoAlpha: 1, scale: 1, duration: 0.58, ease: "none" }
          )
          .to(image, {
            autoAlpha: 0.2,
            scale: 0.97,
            duration: 0.42,
            ease: "none",
          });
      });

      gsap.from(".motion-metric", {
        autoAlpha: 0,
        y: 24,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".motion-metrics",
          start: "top 82%",
          end: "center 58%",
          scrub: 0.45,
        },
      });

      ScrollTrigger.refresh();
    },
    { scope }
  );

  return (
    <div ref={scope} className="contents">
      {children}
    </div>
  );
}

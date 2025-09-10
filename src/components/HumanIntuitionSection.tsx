import React, { useEffect, useRef } from "react";
import dataScienceAnimation from "@/assets/data-science-animation.jpg";

const HumanIntuitionSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const elements = entry.target.querySelectorAll(".fade-in-element");
            elements.forEach((el, index) => {
              setTimeout(() => {
                el.classList.add("animate-fade-in");
              }, index * 100);
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    
    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-white relative" id="human-intuition" ref={sectionRef}>
      <div className="section-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left content */}
          <div className="space-y-6">
            <div className="pulse-chip opacity-0 fade-in-element">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-pulse-500 text-white mr-2">03</span>
              <span>Data Science</span>
            </div>
            
            <h2 className="section-title opacity-0 fade-in-element">
              TeamIQ works with your team, not instead of it
            </h2>
            
            <p className="section-subtitle opacity-0 fade-in-element">
              By analyzing communication patterns, monitoring engagement levels, and identifying decision-making bottlenecks, TeamIQ helps teams focus on what they do best: collaborate, innovate, and solve complex problems together through the power of collective intelligence.
            </p>
            
            <div className="space-y-4 opacity-0 fade-in-element">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-pulse-500 flex items-center justify-center mt-1 flex-shrink-0">
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-gray-600">Identifies communication patterns and participation imbalances</p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-pulse-500 flex items-center justify-center mt-1 flex-shrink-0">
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-gray-600">Tracks decision-making effectiveness and consensus building</p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-pulse-500 flex items-center justify-center mt-1 flex-shrink-0">
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-gray-600">Provides actionable insights to enhance team performance</p>
              </div>
            </div>
          </div>
          
          {/* Right image */}
          <div className="relative opacity-0 fade-in-element">
            <div className="absolute inset-0 bg-gradient-to-r from-pulse-500/20 to-orange-500/20 rounded-2xl sm:rounded-3xl blur-2xl"></div>
            <img 
              src={dataScienceAnimation} 
              alt="Data Science Animation" 
              className="relative z-10 w-full h-auto rounded-2xl sm:rounded-3xl shadow-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HumanIntuitionSection;
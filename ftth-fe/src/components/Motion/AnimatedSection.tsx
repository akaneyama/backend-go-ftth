import React from 'react';
import { useInView } from 'react-intersection-observer';

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
}

function AnimatedSection({ children, className }: AnimatedSectionProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <section
      ref={ref}
      className={`${className} transition-opacity duration-700 ease-out ${inView ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className={inView ? 'animate-fade-in-up' : ''}>
          {children}
      </div>
    </section>
  );
}

export default AnimatedSection;
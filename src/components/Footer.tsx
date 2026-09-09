import React from 'react';
import ShinyText from './ShinyText';
import { useTheme } from '@/contexts/ThemeContext';

const Footer: React.FC = () => {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? '#b5b5b5' : '#1f2937';
  const shineColor = '#C5C5C5';

  return (
    <footer className="w-full py-4 text-center ">
      <a
        href="https://grupodte.com"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground"
      >
        <ShinyText
          text="Built by DTE"
          speed={2}
          delay={0}
          color="#b5b5b5"
          shineColor="#C5C5C5"
          spread={120}
          direction="left"
          yoyo={false}
          pauseOnHover={false}
          disabled={false}
          fontSize={11}
        />
      </a>
    </footer>
  );
};

export default Footer;
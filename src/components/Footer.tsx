import React from 'react';
import ShinyText from './ShinyText';
import { useTheme } from '@/contexts/ThemeContext';

const Footer: React.FC = () => {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? '#b5b5b5' : '#1f2937';
  const shineColor = '#ffffff';

  return (
    <footer className="w-full py-4 text-center ">
      <a
        href="https://grupodte.com"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ShinyText
          text="Built by DTE"
          speed={2}
          delay={0}
          color="#b5b5b5"
          shineColor="#ffffff"
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
import React, { useState, useEffect } from 'react';
import type { ComponentProps } from 'react'; // pakai type-only import
import { motion } from 'framer-motion';
import LoadingSpinner from './LoadingSpinner';

type LazyMotionImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt'
> & {
  src: string;
  alt: string;
} & ComponentProps<typeof motion.div>;

const LazyMotionImage: React.FC<LazyMotionImageProps> = ({ src, alt, ...props }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    const img = new Image();
    img.src = src;

    img.onload = () => setIsLoading(false);
    img.onerror = () => {
      console.error(`Gagal memuat gambar: ${src}`);
      setIsLoading(false);
    };
  }, [src]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isLoading ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      style={{ position: 'relative', width: '100%', height: '100%' }}
      {...props}
    >
      {isLoading && <LoadingSpinner />}
      <img src={src} alt={alt} />
    </motion.div>
  );
};

export default LazyMotionImage;

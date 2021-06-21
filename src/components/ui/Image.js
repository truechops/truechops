import { memo } from 'react';

export default memo(function Image({ src, className }) {
    return <img src={src} className={className} />;
  });
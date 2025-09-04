import React from 'react';

const Spinner = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className="animate-spin"
  >
    <defs>
      <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6D35FF" />
        <stop offset="100%" stopColor="#D8B4FE" />
      </linearGradient>
    </defs>
    <path
      d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
      opacity=".25"
      fill="currentColor"
    />
    <path
      d="M12,4a8,8,0,0,1,7.89,6.7A1.5,1.5,0,0,0,21.39,12h0a1.5,1.5,0,0,0-1.48-1.75,5,5,0,0,0-4.9-4.9A1.5,1.5,0,0,0,13.25,3.61,1.5,1.5,0,0,0,12,2.13h0A1.5,1.5,0,0,0,10.75,3.61,1.5,1.5,0,0,0,9.49,5.36a5,5,0,0,0-4.9,4.9A1.5,1.5,0,0,0,3.11,12H3.11a1.5,1.5,0,0,0,1.48,1.75A8,8,0,0,1,12,4Z"
      fill="url(#spinnerGradient)"
    />
  </svg>
);

export default Spinner;

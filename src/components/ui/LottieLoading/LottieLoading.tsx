"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import animationData from "../../../../public/lottieLoading/Pet Loading.json";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface LottieLoadingProps {
  width?: string | number;
  height?: string | number;
}

const LottieLoading = ({ width = 250, height = 250 }: LottieLoadingProps) => {
  // Deep copy and modify animation data to replace specific colors
  const modifiedAnimationData = useMemo(() => {
    const data = JSON.parse(JSON.stringify(animationData));
    
    // Target blue color in the JSON: [0.098, 0.3059, 0.5804, 1]
    // Target primary color (#e67e22): [0.902, 0.494, 0.133, 1]
    const targetBlue = [0.098, 0.3059, 0.5804];
    const replacementColor = [0.902, 0.494, 0.133];

    const replaceColor = (obj: any) => {
      if (typeof obj !== "object" || obj === null) return;

      // Helper to check and replace color in a 3-4 element array
      const checkAndReplace = (arr: any) => {
        if (Array.isArray(arr) && arr.length >= 3 && typeof arr[0] === "number") {
          const [r, g, b] = arr;
          // Blue check: r around 0.1, g around 0.3, b around 0.6
          // Using a small tolerance to be safe
          const isBlue = Math.abs(r - targetBlue[0]) < 0.01 && 
                         Math.abs(g - targetBlue[1]) < 0.01 && 
                         Math.abs(b - targetBlue[2]) < 0.01;
          
          if (isBlue) {
            arr[0] = replacementColor[0];
            arr[1] = replacementColor[1];
            arr[2] = replacementColor[2];
          }
        }
      };

      // 1. Check direct 'k' property (solid color)
      if (obj.k) {
        if (Array.isArray(obj.k)) {
          if (typeof obj.k[0] === "number") {
            checkAndReplace(obj.k);
          } else {
            // Might be keyframes
            obj.k.forEach((keyframe: any) => {
              if (keyframe.s) checkAndReplace(keyframe.s);
              if (keyframe.e) checkAndReplace(keyframe.e);
            });
          }
        }
      }

      // 2. Some Lotties use 's' or 'e' directly in shapes
      if (obj.s && Array.isArray(obj.s)) checkAndReplace(obj.s);
      if (obj.e && Array.isArray(obj.e)) checkAndReplace(obj.e);

      for (const key in obj) {
        if (key !== 'k') { // Already handled k
          replaceColor(obj[key]);
        }
      }
    };

    replaceColor(data);
    return data;
  }, []);

  return (
    <div 
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: "40px 20px",
        width: "100%",
        minHeight: "300px"
      }}
    >
      <div style={{ width, height }}>
        <Lottie 
          animationData={modifiedAnimationData} 
          loop={true} 
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
};

export default LottieLoading;

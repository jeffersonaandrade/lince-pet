"use client";

import { useState, useMemo } from "react";
import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./UserImage.module.css";

interface UserImageProps {
  src?: string;
  alt: string;
  size?: "small" | "medium" | "large" | number;
  profileRedirect?: string;
  fallbackIcon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function UserImage({
  src,
  alt,
  size = "medium",
  profileRedirect,
  fallbackIcon,
  className = "",
  onClick,
}: UserImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!src);
  const router = useRouter();

  const sizePx = useMemo(() => {
    if (typeof size === "number") return size;
    switch (size) {
      case "small":
        return 40;
      case "large":
        return 100;
      default:
        return 60;
    }
  }, [size]);

  const getSizeClass = () => {
    if (typeof size === "number") {
      return styles.customSize;
    }
    switch (size) {
      case "small":
        return styles.small;
      case "large":
        return styles.large;
      default:
        return styles.medium;
    }
  };

  const getSizeStyle = () => {
    if (typeof size === "number") {
      return {
        width: `${size}px`,
        height: `${size}px`,
      };
    }
    return {};
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (profileRedirect) {
      router.push(profileRedirect);
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const isClickable = onClick || profileRedirect;

  return (
    <div
      className={`${styles.userImageContainer} ${getSizeClass()} ${
        isClickable ? styles.clickable : ""
      } ${className}`}
      style={getSizeStyle()}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      {src && !imageError ? (
        <>
          {isLoading && (
            <div className={styles.loadingPlaceholder}>
              <div className={styles.loadingSpinner} />
            </div>
          )}
          <Image
            src={src}
            alt={alt}
            width={sizePx}
            height={sizePx}
            sizes={`${sizePx}px`}
            quality={90}
            className={`${styles.userImage} ${
              isLoading ? styles.imageLoading : ""
            }`}
            onLoadingComplete={handleImageLoad}
            onError={handleImageError as any}
            priority={false}
          />
        </>
      ) : (
        <div className={styles.fallbackContainer}>
          {fallbackIcon || <User className={styles.fallbackIcon} />}
        </div>
      )}
    </div>
  );
}

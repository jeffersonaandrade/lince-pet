import { useState, ReactNode, cloneElement, isValidElement } from "react";
import { HelpCircle } from "lucide-react";
import styles from "./Tooltip.module.css";

interface TooltipProps {
  text: string;
  size?: "small" | "medium";
  icon?: ReactNode;
  iconColor?: string;
}

export default function Tooltip({
  text,
  size = "small",
  icon,
  iconColor,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const defaultIcon = (
    <HelpCircle
      size={size === "small" ? 16 : 20}
      className={styles.icon}
      style={{ color: iconColor }}
    />
  );

  // Clone the custom icon and apply the color
  const renderIcon = () => {
    if (icon && isValidElement(icon) && iconColor) {
      return cloneElement(
        icon as React.ReactElement<{ style?: React.CSSProperties }>,
        {
          style: { color: iconColor },
        }
      );
    }
    return icon || defaultIcon;
  };

  return (
    <div className={styles.tooltipContainer}>
      <div
        className={styles.iconWrapper}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {renderIcon()}
      </div>
      {isVisible && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipContent}>{text}</div>
          <div className={styles.tooltipArrow}></div>
        </div>
      )}
    </div>
  );
}

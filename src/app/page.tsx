import SearchBar from "../components/Home/SearchBar/SearchBar";
import PlatformFeatures from "../components/Home/PlatformFeatures/PlatformFeatures";
import TypewriterTitle from "../components/Home/TypewriterTitle/TypewriterTitle";
import OnboardingRedirect from "../components/RouteProtection/OnboardingRedirect";
import styles from "./page.module.css";

export default function Home() {
  return (
    <OnboardingRedirect>
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.heroSection}>
            <div className={styles.heroContent}>
              <TypewriterTitle />
              <div
                className={`${styles.heroSearchContainer} ${styles.animateFadeInDelay}`}
              >
                <SearchBar showCatImage={false} />
              </div>
            </div>
          </div>

          <PlatformFeatures />
        </main>
      </div>
    </OnboardingRedirect>
  );
}

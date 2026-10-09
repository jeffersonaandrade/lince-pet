"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronsUpDown,
  User,
  Settings,
  Clock,
  LogOut,
  Menu,
  X,
  Compass,
  LogIn,
  UserPlus,
  Stethoscope,
  Building2,
  Info,
  Phone,
} from "lucide-react";
import UserImage from "../ui/UserImage/UserImage";
import styles from "./header.module.css";
import NotificationBell from "../NotificationBell/NotificationBell";
import { NotificationsService } from "@/services/notifications/notifications";
import { dashboardDoTipo, rotuloDoTipo } from "@/utils/tipoConta";
import IconSilver from "../../../public/img/IconSilver.png";
import NameIconHeader from "../../../public/img/NameIconHeader.png";
import IconDoctor from "../../../public/doctor.svg";
import IconExplore from "../../../public/explore.svg";
import IconHospital from "../../../public/hospital.svg";
import Frame43 from "../../../public/Frame 43.png";
import LincePet from "../../../public/LincePet.png";

export default function Header() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrollPosition, setScrollPosition] = useState<
    "top" | "hero" | "after-hero"
  >("top");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);

  const isHomePage = pathname === "/";
  const getUserInitials = (nome: string) => {
    if (!nome || typeof nome !== "string") {
      return "US";
    }
    return nome
      .split(" ")
      .map((name) => name.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await logout();
    setIsDropdownOpen(false);
  };
  const profileHref = dashboardDoTipo(user?.userType);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isHomePage) {
      const handleScroll = () => {
        const scrollY = window.scrollY;
        const heroHeight = 560;

        if (scrollY === 0) {
          setScrollPosition("top");
        } else if (scrollY > 0 && scrollY <= heroHeight) {
          setScrollPosition("hero");
        } else {
          setScrollPosition("after-hero");
        }
      };

      handleScroll();
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, [isHomePage]);

  // Fecha o menu móvel ao mudar de rota
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Polling de notificações não lidas
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const fetchUnread = async () => {
      try {
        const count = await NotificationsService.getUnreadCount();
        if (mounted) setGlobalUnreadCount(count);
      } catch (err) { }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Fecha o menu móvel ao clicar fora
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        isMobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <header
      className={`${styles.header} ${isHomePage
        ? scrollPosition === "top"
          ? styles.transparent
          : scrollPosition === "hero"
            ? styles.heroBackground
            : styles.solid
        : styles.solid
        }`}
    >
      <div
        className={styles.headerContainer}
      >
        <Link href="/">
          <div className={styles.logo}>
            <Image src={IconSilver} alt="" width={40} height={55} />
            <div className={styles.brandWrap}>
              <Image
                src={LincePet}
                alt="Lince Pet"
                priority
                className={styles.brandImg}
                style={{ height: "25px", width: "auto" }}
              />
            </div>
          </div>
        </Link>
        <div className={styles.centerNav}>
          <>
            <Link href="/explorar" className={styles.navLink}>
              Explorar
            </Link>
            <Link href="/sobre" className={styles.navLink}>
              Sobre
            </Link>
            <Link href="/contato" className={styles.navLink}>
              Contato
            </Link>
          </>
        </div>

        <div className={styles.rightNav}>
          {/* Botão de menu (apenas mobile via CSS) */}
          <button
            type="button"
            className={styles.menuButton}
            aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((v) => !v)}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {loading ? (
            <div style={{ width: 100 }}></div>
          ) : user ? (
            <>
              <div className={styles.userSection} ref={dropdownRef}>
                <button
                  className={styles.userButton}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <UserImage
                      src={user.fotoUrl}
                      alt={`Foto de perfil de ${user.nome}`}
                      size="small"
                    />
                    {globalUnreadCount > 0 && (
                      <span className={styles.headerAvatarBadge} />
                    )}
                  </div>
                  {/* <span className={styles.userName}>{user.nome}</span> */}
                  <ChevronsUpDown
                    size={16}
                    className={`${styles.chevron} ${isDropdownOpen ? styles.chevronOpen : ""
                      }`}
                  />
                </button>

                {isDropdownOpen && (
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                      <div className={styles.userInfo}>
                        <strong>{user.nome}</strong>
                        <span className={styles.userEmail}>{user.email}</span>
                        {user.userType && (
                          <span className={styles.userType}>
                            {rotuloDoTipo(user.userType, user.tipoServico?.nome)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.dropdownDivider}></div>
                    <Link href={profileHref}>
                      <button
                        className={styles.dropdownItem}
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <User size={16} />
                        <span>Perfil</span>
                      </button>
                    </Link>


                    <Link href={profileHref}>
                      <button
                        className={styles.dropdownItem}
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <Clock size={16} />
                        <span>Histórico</span>
                      </button>
                    </Link>
                    
                    <NotificationBell
                      variant="dropdown"
                      className={styles.dropdownItem}
                      onNavigate={() => setIsDropdownOpen(false)}
                      unreadCount={globalUnreadCount}
                      onUnreadCountChange={setGlobalUnreadCount}
                    />
                    <div className={styles.dropdownDivider}></div>
                    <button
                      className={styles.dropdownItem}
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      <span>Sair</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.authButtons}>
              <Link href="/login" className={styles.loginLink}>
                Entrar
              </Link>
              <Link href="/signup" className={styles.signupBtn}>
                Cadastrar
              </Link>
            </div>
          )}
        </div>

        {/* Backdrop e Menu Lateral (mobile) */}
        {isMobileMenuOpen && (
          <div
            className={styles.backdrop}
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        <aside
          ref={mobileMenuRef}
          className={`${styles.sideMenu} ${isMobileMenuOpen ? styles.open : ""
            }`}
          aria-hidden={!isMobileMenuOpen}
        >
          <div className={styles.sideMenuHeader}>
            <span>Menu</span>
            <button
              type="button"
              className={styles.sideMenuClose}
              aria-label="Fechar menu"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <div className={styles.mobileMenu}>


            <div className={styles.menuSection}>
              <div className={styles.menuSectionTitle}>Navegar</div>
              <Link
                href="/explorar"
                className={styles.mobileMenuLink}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className={styles.menuIcon}>
                  <Compass size={18} />
                </span>
                Explorar
              </Link>
              <Link
                href="/sobre"
                className={styles.mobileMenuLink}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className={styles.menuIcon}>
                  <Info size={18} />
                </span>
                Sobre
              </Link>
              <Link
                href="/contato"
                className={styles.mobileMenuLink}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className={styles.menuIcon}>
                  <Phone size={18} />
                </span>
                Contato
              </Link>
            </div>

            <div className={styles.menuDivider}></div>

            <div className={styles.menuSection}>
              <div className={styles.menuSectionTitle}>Conta</div>
              {/* Also check loading here? Maybe less critical for mobile menu since it starts closed */}
              {loading ? (
                <div style={{ padding: '0.8rem', color: '#666' }}>Carregando...</div>
              ) : user ? (
                <>
                  <div className={styles.mobileUserHeader}>
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <UserImage
                        src={user.fotoUrl}
                        alt={`Foto de perfil de ${user.nome}`}
                        size="medium"
                      />
                      {globalUnreadCount > 0 && (
                        <span className={styles.headerAvatarBadge} />
                      )}
                    </div>
                    <div className={styles.mobileUserInfo}>
                      <strong>{user.nome}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <div className={styles.menuDivider}></div>
                  <NotificationBell
                    variant="mobile"
                    onNavigate={() => setIsMobileMenuOpen(false)}
                    unreadCount={globalUnreadCount}
                    onUnreadCountChange={setGlobalUnreadCount}
                  />
                  <Link
                    href={profileHref}
                    className={styles.mobileMenuLink}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className={styles.menuIcon}>
                      <User size={18} />
                    </span>
                    Perfil
                  </Link>
                  <button
                    type="button"
                    className={`${styles.mobileMenuLink} ${styles.dangerLink}`}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <span className={styles.menuIcon}>
                      <LogOut size={18} />
                    </span>
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={styles.mobileMenuLink}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className={styles.menuIcon}>
                      <LogIn size={18} />
                    </span>
                    Entrar
                  </Link>
                  <Link
                    href="/signup"
                    className={`${styles.mobileMenuLink} ${styles.primaryLink}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className={styles.menuIcon}>
                      <UserPlus size={18} />
                    </span>
                    Cadastrar
                  </Link>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </header>
  );
}

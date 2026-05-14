import React, { useEffect, useState } from 'react';
import styles from './Header.module.css';
import { useLocation, useNavigate as UseRealNavigate } from 'react-router-dom';
import { SlArrowDown } from 'react-icons/sl';
import { LuMenu, LuShoppingCart, LuX, LuHouse, LuFilePlus, LuTag, LuLightbulb, LuMessageSquare, LuUser, LuArrowRight, LuGlobe, LuFactory } from 'react-icons/lu';
import { useDispatch, useSelector } from 'react-redux';
import { logout, mergeUser } from '../../store/reducers/user';
import Flag from 'react-flagkit';
import { $authHost } from '../../http';
import { resetEditorStateForUserSwitch } from '../../utils/projectStorage';
import LogoSvg from './LogoSvg';
import i18n, { prefixedLngs } from '../../i18n';
import Link from '../Localized/LocalizedLink';
import useNavigate from '../Localized/useLocalizedNavigate';
import { useTranslation } from 'react-i18next';
 
// eslint-disable-next-line react-refresh/only-export-components
export const languageCountries = [
  { flag: "🇩🇪", code: "DE", codeFlag: "DE" },
  { flag: "🇬🇧", code: "EN", codeFlag: "GB" },
  { flag: "🇫🇷", code: "FR", codeFlag: "FR" },
  { flag: "🇮🇹", code: "IT", codeFlag: "IT" },
  { flag: "🇨🇿", code: "CS", codeFlag: "CZ" },
  { flag: "🇩🇰", code: "DA", codeFlag: "DK" },
  { flag: "🇪🇸", code: "ES", codeFlag: "ES" },
  { flag: "🇪🇪", code: "ET", codeFlag: "EE" },
  { flag: "🇭🇷", code: "HR", codeFlag: "HR" },
  { flag: "🇭🇺", code: "HU", codeFlag: "HU" },
  { flag: "🇱🇹", code: "LT", codeFlag: "LT" },
  { flag: "🇳🇱", code: "NL", codeFlag: "NL" },
  { flag: "🇵🇱", code: "PL", codeFlag: "PL" },
  { flag: "🇷🇴", code: "RO", codeFlag: "RO" },
  { flag: "🇸🇰", code: "SK", codeFlag: "SK" },
  { flag: "🇸🇮", code: "SL", codeFlag: "SI" },
  { flag: "🇸🇪", code: "SV", codeFlag: "SE" },
  { flag: "🇺🇦", code: "UA", codeFlag: "UA" },
];



const Header = () => {
  const { t } = useTranslation();
  const EDITOR_AUTH_USER_KEY = 'editorAuthUserId';
  const { pathname } = useLocation(); // <-- тут шлях
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileLangOpen, setIsMobileLangOpen] = useState(false);

  const [urls, setUrls] = useState([
    {
      name: 'Home',
      labelKey: 'Header.nav.home',
      url: '/',
    },
    {
      name: 'Registration',
      labelKey: 'Header.nav.registration',
      url: '/login',
    },
    {
      name: 'New Project',
      labelKey: 'Header.nav.newProject',
      url: '/online-sign-editor',
    },
    {
      name: 'FAQ',
      labelKey: 'Header.nav.faq',
      url: '/faq',
    },
    {
      name: 'Products',
      labelKey: 'Header.nav.products',
      url: '/products',
    },
    {
      name: 'Industries',
      labelKey: 'Header.nav.industries',
      url: '/industries',
    },
    {
      name: 'Quick Guide',
      labelKey: 'Header.nav.quickGuide',
      url: '/quick-guide',
    },
    {
      name: 'Contacts',
      labelKey: 'Header.nav.contacts',
      url: '/contacts',
    },
  ]);
  const { isAuth, isAdmin, user } = useSelector(state => state.user);

  useEffect(() => {
    const newUrls = [
      {
        name: 'Home',
        labelKey: 'Header.nav.home',
        url: '/',
      },
    ];

    if (!isAuth) {
      newUrls.push({
        name: 'Registration',
        labelKey: 'Header.nav.registration',
        url: '/login',
      });
    } else {
      newUrls.push({
        name: 'My Account',
        labelKey: 'Header.nav.myAccount',
        url: '/account',
      });
    }

    newUrls.push(
      ...[
        {
          name: 'New Project',
          labelKey: 'Header.nav.newProject',
          url: '/online-sign-editor',
        },
        {
          name: 'Products',
          labelKey: 'Header.nav.products',
          url: '/products',
        },
        {
          name: 'Industries',
          labelKey: 'Header.nav.industries',
          url: '/industries',
        },
        {
          name: 'FAQ',
          labelKey: 'Header.nav.faq',
          url: '/faq',
        },
        {
          name: 'Quick Guide',
          labelKey: 'Header.nav.quickGuide',
          url: '/quick-guide',
        },
        {
          name: 'Contacts',
          labelKey: 'Header.nav.contacts',
          url: '/contacts',
        },
      ]
    );

    if (isAdmin) {
      newUrls.push({
        name: 'Admin',
        labelKey: 'Header.nav.admin',
        url: '/admin',
      });
    }

    setUrls(newUrls);
  }, [isAuth, isAdmin]);

  const dispatch = useDispatch();

  const exit = async () => {
    try {
      await resetEditorStateForUserSwitch();
    } catch {
      // Best-effort cleanup on logout.
    }
    try {
      localStorage.removeItem(EDITOR_AUTH_USER_KEY);
    } catch {
      // Best-effort cleanup on logout.
    }
    dispatch(logout());
  };

  useEffect(() => {
    if (!isAuth || !user?.id) return;

    let cancelled = false;

    const ensureIsolatedEditorState = async () => {
      try {
        const nextUserId = String(user.id || '').trim();
        if (!nextUserId) return;

        const prevUserId = String(localStorage.getItem(EDITOR_AUTH_USER_KEY) || '').trim();
        if (prevUserId && prevUserId !== nextUserId) {
          await resetEditorStateForUserSwitch();
          if (cancelled) return;
        }

        localStorage.setItem(EDITOR_AUTH_USER_KEY, nextUserId);
      } catch (error) {
        console.warn('Failed to isolate editor state on auth switch', error);
      }
    };

    ensureIsolatedEditorState();

    return () => {
      cancelled = true;
    };
  }, [isAuth, user?.id]);

  useEffect(() => {
    if (!isAuth) return;

    let isMounted = true;

    const refreshUserFromDb = async () => {
      try {
        const res = await $authHost.get('auth/getMy');
        const freshUser = res?.data?.user;
        if (isMounted && freshUser) {
          dispatch(mergeUser(freshUser));
        }
      } catch (err) {
        console.warn('Header: failed to refresh user from DB', err);
      }
    };

    // initial sync after mount/auth
    refreshUserFromDb();

    const onWindowFocus = () => {
      refreshUserFromDb();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUserFromDb();
      }
    };

    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuth, dispatch]);

  const navigate = useNavigate();

  const IMG_URL = import.meta.env.VITE_LAYOUT_SERVER;

  const menuIcons = {
    '/': <LuHouse size={18} />,
    '/login': <LuUser size={18} />,
    '/account': <LuUser size={18} />,
    '/online-sign-editor': <LuFilePlus size={18} />,
    '/products': <LuTag size={18} />,
    '/industries': <LuFactory size={18} />,
    '/faq': <LuLightbulb size={18} />,
    '/quick-guide': <LuLightbulb size={18} />,
    '/contacts': <LuMessageSquare size={18} />,
    '/admin': <LuUser size={18} />,
  };
  const currentLanguage = languageCountries.find(x => x.code.toLowerCase() === i18n.language) || languageCountries[0];

  const realNavigate=UseRealNavigate();

  const setLangOpen = (code) => {
    setIsLangOpen(false);

    const lang = code.toLowerCase();
    const isDefaultLanguage = lang === 'de';

    const pathParts = location.pathname.split('/').filter(Boolean);

    const hasLangPrefix = prefixedLngs.includes(pathParts[0]);

    const cleanPath = hasLangPrefix
      ? pathParts.slice(1)
      : pathParts;

    const newUrl = isDefaultLanguage
      ? `/${cleanPath.join('/')}`
      : `/${lang}/${cleanPath.join('/')}`;

    realNavigate(newUrl || '/');
  };

    useEffect(() => {
      const pathParts = location.pathname.split('/').filter(Boolean);

      // чи є префікс мови
      const urlLang = prefixedLngs.includes(pathParts[0])
        ? pathParts[0]
        : 'de';

      // змінюємо мову тільки якщо треба
      if (i18n.language !== urlLang) {
        i18n.changeLanguage(urlLang);
      }
    }, [location.pathname]);

  return (
    <>
    {/* Mobile bar */}
    <div className={styles.mobileBar}>
      <button className={styles.mobileIconBtn} onClick={() => setIsMobileMenuOpen(true)}>
        <LuMenu size={24} />
      </button>
      <div className={styles.mobileLogoWrap} onClick={() => navigate('/')}>
        <LogoSvg />
      </div>
      <button className={styles.mobileIconBtn}>
        <LuShoppingCart size={20} />
      </button>
    </div>

    {/* Mobile drawer overlay */}
    {isMobileMenuOpen && (
      <div className={styles.mobileOverlay} onClick={() => setIsMobileMenuOpen(false)}>
        <div className={styles.mobileDrawer} onClick={e => e.stopPropagation()}>

          {/* Drawer header: logo + circle-X */}
          <div className={styles.drawerHeader}>
            <div className={styles.drawerLogoWrap}><LogoSvg /></div>
            <button className={styles.drawerCloseBtn} onClick={() => setIsMobileMenuOpen(false)}>
              <LuX size={14} color='#006CA4'/>
            </button>
          </div>

          {/* Easy / Fast / Quick rows */}
          <div className={styles.drawerFeatures}>
            {[
              ['Header.features.easy', 'Header.features.design'],
              ['Header.features.fast', 'Header.features.manufacturing'],
              ['Header.features.quick', 'Header.features.delivery'],
            ].map(([kw, val]) => (
              <div key={kw} className={styles.drawerFeatureRow}>
                <svg width="14" height="9" viewBox="0 0 20 16" fill="none" className={styles.drawerCheckSvg}>
                  <path d="M2 6.51613L7.33333 12L18 2" stroke="#0BC944" strokeWidth="4"/>
                </svg>
                <span className={styles.drawerKeyword}>{t(kw)}</span>
                <span className={styles.drawerValue}>{t(val)}</span>
              </div>
            ))}
          </div>

          {/* Language selector */}
          <div className={`${styles.drawerLang} ${isMobileLangOpen ? styles.drawerLangOpen : ''}`}>
            <div className={styles.drawerLangTrigger} onClick={() => setIsMobileLangOpen(!isMobileLangOpen)}>
              <div className={styles.drawerLangLeft}>
                <LuGlobe size={18} />
                <span>{currentLanguage.code}</span>
              </div>
              <div className={isMobileLangOpen ? styles.rotate : ''}>
                <SlArrowDown size={14} />
              </div>
            </div>
            {isMobileLangOpen && (
              <div className={styles.drawerLangList}>
                <div className={styles.drawerLangScroll}>
                  {languageCountries.map(lang => (
                    <div
                      key={lang.code}
                      className={`${styles.drawerLangItem} ${lang.code === currentLanguage.code ? styles.drawerLangItemActive : ''}`}
                      onClick={() => {
                        setLangOpen(lang.code);
                        setIsMobileLangOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <Flag size={15} country={lang.codeFlag} />
                      <span>{lang.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MENU section */}
          <div className={styles.drawerSection}>
            <p className={styles.drawerSectionLabel}>{t('Header.sections.menu')}</p>
            <div className={styles.drawerNavList}>
              {urls.map(x => (
                <Link
                  key={x.url}
                  to={x.url}
                  className={`${styles.drawerNavItem} ${pathname === x.url ? styles.drawerNavItemActive : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className={styles.drawerNavIcon}>{menuIcons[x.url] || <LuHouse size={18} />}</span>
                  {t(x.labelKey || x.name)}
                </Link>
              ))}
            </div>
          </div>

          {/* ACCOUNT section */}
          <div className={styles.drawerSection}>
            <p className={styles.drawerSectionLabel}>{t('Header.sections.account')}</p>
            {isAuth ? (
              <div className={styles.drawerAccount}>
                <div className={styles.drawerUserRow}>
                  <div className={styles.drawerAvatar}><LuUser size={16} /></div>
                  <div className={styles.drawerUserInfo}>
                    <p className={styles.drawerUserName}>{`${user?.firstName || ''} ${user?.surname || ''}`.trim()}</p>
                    <p className={styles.drawerUserCompany}>{user?.company || ''}</p>
                  </div>
                </div>
                <button className={styles.drawerLogout} onClick={() => { exit(); setIsMobileMenuOpen(false); }}>
                  <LuArrowRight size={16} color="#a0353b" /> {t('Header.auth.logout')}
                </button>
              </div>
            ) : (
              <button className={styles.drawerLogout} onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}>
                <LuArrowRight size={16} color="#a0353b" /> {t('Header.auth.loginRegisterSlash')}
              </button>
            )}
          </div>

        </div>
      </div>
    )}

    {/* Desktop header */}
    <div className={styles.header}>
      <div className={styles.firstPart}>
        <div onClick={()=>navigate('/')} style={{cursor:'pointer'}} className={styles.leftPart}>
        <div className={styles.desktopLogoWrap}><LogoSvg/></div>
          <ul className={styles.leftList}>
            <li className={styles.leftListEl}>
              <svg
                width="20"
                height="16"
                viewBox="0 0 20 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2 6.51613L7.33333 12L18 2" stroke="#0BC944" strokeWidth="5" />
              </svg>
            </li>
            <li className={styles.leftListEl}>{t('Header.features.easy')}</li>
            <li>{t('Header.features.design')}</li>
            <li className={styles.leftListEl}>
              <svg
                width="20"
                height="16"
                viewBox="0 0 20 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2 6.51613L7.33333 12L18 2" stroke="#0BC944" strokeWidth="5" />
              </svg>
            </li>
            <li className={styles.leftListEl}>{t('Header.features.fast')}</li>
            <li>{t('Header.features.manufacturing')}</li>
            <li className={styles.leftListEl}>
              <svg
                width="20"
                height="16"
                viewBox="0 0 20 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2 6.51613L7.33333 12L18 2" stroke="#0BC944" strokeWidth="5" />
              </svg>
            </li>
            <li className={styles.leftListEl}>{t('Header.features.quick')}</li>
            <li>{t('Header.features.delivery')}</li>
          </ul>
        </div>
        <div className={styles.headerBaner}>
          <img className={styles.headerBanerImg} src={IMG_URL + `images/baner/${currentLanguage.code}.jpeg`}/>
        </div>
        <div className={styles.rightPart}>
          <div className={styles.rightPartWrapper}>
            <p className={styles.name}>{isAuth ? `${user?.firstName || ''} ${user?.surname || ''}`.trim() : ''}</p>
            <p className={styles.company} style={{textAlign:'right'}}>{isAuth ? (user?.company || '') : ''}</p>
          </div>
          <p onClick={()=>isAuth? exit():navigate('/login')} className={styles.logOut} style={{ margin: 0 }}>
            {isAuth ? t('Header.auth.logout') : <>{t('Header.auth.loginOr')} <span style={{color:'red'}}>{t('Header.auth.register')}</span></>}
          </p>

          <div className={styles.lang}>
            <div
              style={{ display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center',fontSize:'16px' }}
              onClick={() => setIsLangOpen(!isLangOpen)}
            >
              {//<Flag country="DE" size={32} />
}
              <Flag size={22} country={currentLanguage.codeFlag} /> {currentLanguage.code}
              <div className={isLangOpen&&styles.rotate}>
                <SlArrowDown size={14} />
              </div>
            </div>
            <div className={isLangOpen ? styles.dropdown : styles.open}>
              {languageCountries.filter(x=>x.code.toLocaleLowerCase()!=i18n.language).map(lang => (
                <div
                  key={lang.code}
                  onClick={() => {setLangOpen(lang.code)}}
                  className={styles.countries}
                  style={{whiteSpace:"nowrap"}}
                >
                  {//<Flag country={lang.countryCode} size={32} />
}
                  <Flag size={20} country={lang.codeFlag} /> {lang.code}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.secondPart}>
        <ul className={styles.secondPartList}>
          {urls.map(x => (
            <li
              key={x.url}
              className={`${styles.secondPartEl2} ${pathname == x.url ? styles.current : ''}`}
            >
              <Link to={`${x.url}`}>{t(x.labelKey || x.name)}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
    </>
  );
};

export default Header;

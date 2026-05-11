import React, { useEffect, useState } from 'react';
import styles from './Header.module.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { SlArrowDown } from 'react-icons/sl';
import { LuMenu, LuShoppingCart, LuX, LuHouse, LuFilePlus, LuImage, LuTag, LuLightbulb, LuMessageSquare, LuUser, LuArrowRight, LuGlobe, LuFactory } from 'react-icons/lu';
import { useDispatch, useSelector } from 'react-redux';
import { logout, mergeUser } from '../../store/reducers/user';
import combinedCountries from '../Countries';
import Flag from 'react-flagkit';
import { $authHost } from '../../http';
import { resetEditorStateForUserSwitch } from '../../utils/projectStorage';
import LogoSvg from './LogoSvg';
import i18n, { prefixedLngs } from '../../i18n';
import Link from '../Localized/LocalizedLink';
 
export const languageCountries = [
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
  { flag: "🇩🇪", code: "DE", codeFlag: "DE" },
];



const Header = () => {
  const EDITOR_AUTH_USER_KEY = 'editorAuthUserId';
  const { pathname } = useLocation(); // <-- тут шлях
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileLangOpen, setIsMobileLangOpen] = useState(false);

  const [urls, setUrls] = useState([
    {
      name: 'Home',
      url: '/',
    },
    {
      name: 'Registration',
      url: '/login',
    },
    {
      name: 'New Project',
      url: '/online-sign-editor',
    },
    {
      name: 'Templates',
      name: 'FAQ',
      url: '/faq',
    },
    {
      name: 'Products',
      url: '/products',
    },
    {
      name: 'Industries',
      url: '/industries',
    },
    {
      name: 'Quick Guide',
      url: '/quick-guide',
    },
    {
      name: 'Contacts',
      url: '/contacts',
    },
  ]);
  const { isAuth, isAdmin, user } = useSelector(state => state.user);

  useEffect(() => {
    const newUrls = [
      {
        name: 'Home',
        url: '/',
      },
    ];

    if (!isAuth) {
      newUrls.push({
        name: 'Registration',
        url: '/login',
      });
    } else {
      newUrls.push({
        name: 'My Account',
        url: '/account',
      });
    }

    newUrls.push(
      ...[
        {
          name: 'New Project',
          url: '/online-sign-editor',
        },
        {
          name: 'Products',
          url: '/products',
        },
        {
          name: 'Industries',
          url: '/industries',
        },
        {
          name: 'FAQ',
          url: '/faq',
        },
        {
          name: 'Quick Guide',
          url: '/quick-guide',
        },
        {
          name: 'Contacts',
          url: '/contacts',
        },
      ]
    );

    if (isAdmin) {
      newUrls.push({
        name: 'Admin',
        url: '/admin',
      });
    }

    setUrls(newUrls);
  }, [isAuth, isAdmin]);

  const dispatch = useDispatch();

  const exit = async () => {
    try {
      await resetEditorStateForUserSwitch();
    } catch {}
    try {
      localStorage.removeItem(EDITOR_AUTH_USER_KEY);
    } catch {}
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

  const setLangOpen = (code) => {
    setIsLangOpen(false);

    const lang = code.toLowerCase();
    const isEnglish = lang === 'en';

    const pathParts = location.pathname.split('/').filter(Boolean);

    const hasLangPrefix = prefixedLngs.includes(pathParts[0]);

    const cleanPath = hasLangPrefix
      ? pathParts.slice(1)
      : pathParts;

    const newUrl = isEnglish
      ? `/${cleanPath.join('/')}`
      : `/${lang}/${cleanPath.join('/')}`;

    navigate(newUrl || '/');
  };

    useEffect(() => {
      const pathParts = location.pathname.split('/').filter(Boolean);

      // чи є префікс мови
      const urlLang = prefixedLngs.includes(pathParts[0])
        ? pathParts[0]
        : 'en';

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
            {[['Easy','Design'],['Fast','Manufacturing'],['Quick','Delivery']].map(([kw, val]) => (
              <div key={kw} className={styles.drawerFeatureRow}>
                <svg width="14" height="9" viewBox="0 0 20 16" fill="none" className={styles.drawerCheckSvg}>
                  <path d="M2 6.51613L7.33333 12L18 2" stroke="#0BC944" strokeWidth="4"/>
                </svg>
                <span className={styles.drawerKeyword}>{kw}</span>
                <span className={styles.drawerValue}>{val}</span>
              </div>
            ))}
          </div>

          {/* Language selector */}
          <div className={`${styles.drawerLang} ${isMobileLangOpen ? styles.drawerLangOpen : ''}`}>
            <div className={styles.drawerLangTrigger} onClick={() => setIsMobileLangOpen(!isMobileLangOpen)}>
              <div className={styles.drawerLangLeft}>
                <LuGlobe size={18} />
                <span>DE</span>
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
                      className={`${styles.drawerLangItem} ${lang.code === 'DE' ? styles.drawerLangItemActive : ''}`}
                      onClick={() => setIsMobileLangOpen(false)}
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
            <p className={styles.drawerSectionLabel}>Menu</p>
            <div className={styles.drawerNavList}>
              {urls.map(x => (
                <Link
                  key={x.url}
                  to={x.url}
                  className={`${styles.drawerNavItem} ${pathname === x.url ? styles.drawerNavItemActive : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className={styles.drawerNavIcon}>{menuIcons[x.url] || <LuHouse size={18} />}</span>
                  {x.name}
                </Link>
              ))}
            </div>
          </div>

          {/* ACCOUNT section */}
          <div className={styles.drawerSection}>
            <p className={styles.drawerSectionLabel}>Account</p>
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
                  <LuArrowRight size={16} color="#a0353b" /> Log out
                </button>
              </div>
            ) : (
              <button className={styles.drawerLogout} onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}>
                <LuArrowRight size={16} color="#a0353b" /> Log in / Register
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
            <li className={styles.leftListEl}>Easy</li>
            <li>Design</li>
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
            <li className={styles.leftListEl}>Fast</li>
            <li>Manufacturing</li>
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
            <li className={styles.leftListEl}>Quick</li>
            <li>Delivery</li>
          </ul>
        </div>
        <div className={styles.headerBaner}>
          <img className={styles.headerBanerImg} src={IMG_URL + `images/baner/${(location.pathname.length === 3 || location.pathname[3] !== '/') ? 'DE' : location.pathname.slice(1, 3).toUpperCase()}.jpeg`}/>
        </div>
        <div className={styles.rightPart}>
          <div className={styles.rightPartWrapper}>
            <p className={styles.name}>{isAuth ? `${user?.firstName || ''} ${user?.surname || ''}`.trim() : ''}</p>
            <p className={styles.company} style={{textAlign:'right'}}>{isAuth ? (user?.company || '') : ''}</p>
          </div>
          <p onClick={()=>isAuth? exit():navigate('/login')} className={styles.logOut} style={{ margin: 0 }}>
            {isAuth ? 'Log out' : <>Log in or <span style={{color:'red'}}>Register</span></>}
          </p>

          <div className={styles.lang}>
            <div
              style={{ display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center',fontSize:'16px' }}
              onClick={() => setIsLangOpen(!isLangOpen)}
            >
              {//<Flag country="DE" size={32} />
}
              <Flag size={22} country={languageCountries.find(x=>x.code.toLocaleLowerCase()==i18n.language)?.codeFlag||'DE'} /> {languageCountries.find(x=>x.code.toLocaleLowerCase()==i18n.language)?.code.toLocaleUpperCase()||'DE'}
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
              <Link to={`${x.url}`}>{x.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
    </>
  );
};

export default Header;
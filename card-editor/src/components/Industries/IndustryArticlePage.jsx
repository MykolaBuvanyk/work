import React, { useMemo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { ARTICLE_ROUTE_MAP } from './articleRoutes';

const getLangPrefix = (pathname = '') => {
  const match = String(pathname).match(/^\/([a-z]{2})(\/|$)/i);
  return match ? `/${match[1]}` : '';
};

const IndustryArticlePage = () => {
  const { sectionSlug, articleSlug } = useParams();
  const { pathname } = useLocation();
  const prefix = getLangPrefix(pathname);

  const ArticleComponent = useMemo(
    () => ARTICLE_ROUTE_MAP[sectionSlug]?.[articleSlug],
    [articleSlug, sectionSlug]
  );

  if (!ArticleComponent) {
    return <Navigate to={`${prefix}/industries`} replace />;
  }

  return <ArticleComponent />;
};

export default IndustryArticlePage;

"use client";
import NextLink from 'next/link';

export function Link({ to, href, ...props }) {
  return <NextLink href={to || href || "#"} {...props} />;
}
import { useRouter as useNextRouter, usePathname, useParams as useNextParams, useSearchParams as useNextSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

export function useNavigate() {
  const router = useNextRouter();
  return (path, options) => {
    if (options?.replace) router.replace(path);
    else router.push(path);
  };
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useNextSearchParams();
  return {
    pathname,
    search: searchParams ? `?${searchParams.toString()}` : '',
    hash: ''
  };
}

export function useParams() {
  return useNextParams();
}

export function useSearchParams() {
  const searchParams = useNextSearchParams();
  const get = (key) => searchParams.get(key);
  const entries = () => searchParams.entries();
  
  // Return a mock similar to URLSearchParams that react-router-dom provides
  // Note: Next.js useSearchParams is read-only.
  return [
    searchParams,
    (newParams) => {
      // In a full implementation, you'd push the new params to the router
      console.warn('setSearchParams is not fully implemented in shim');
    }
  ];
}

export function Navigate({ to, replace }) {
  const router = useNextRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);
  return null;
}

import React from 'react';
import { createPortal } from 'react-dom';
import { LogtoProvider, useHandleSignInCallback, useLogto, type IdTokenClaims, type LogtoConfig } from '@logto/react';

type AuthProviderRootProps = {
    config: LogtoConfig | null;
    children: React.ReactNode;
};

const appOrigin = () => window.location.origin;
const callbackUri = () => `${appOrigin()}/callback`;
const publicSelector = '[data-auth-public="true"]';

export const AuthProviderRoot: React.FC<AuthProviderRootProps> = ({ config, children }) => {
    if (!config) return <>{children}</>;
    return <LogtoProvider config={config}>{children}</LogtoProvider>;
};

const CallbackView: React.FC = () => {
    const { isLoading, error } = useHandleSignInCallback(() => {
        window.location.replace('/');
    });

    return (
        <div className="financial-shell flex h-screen w-screen items-center justify-center bg-[var(--app-bg)] text-[var(--text-primary)]">
            <div className="border border-[var(--border-color)] bg-[var(--panel-bg)] px-8 py-6">
                <div className="font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--accent-text)]">
                    AUTH
                </div>
                <div className="mt-2 text-xl font-semibold">
                    {error ? '登录回调失败' : isLoading ? '正在完成登录' : '登录完成'}
                </div>
                {error && <div className="mt-3 max-w-md text-sm text-red-700">{error.message}</div>}
            </div>
        </div>
    );
};

const isPublicAuthTarget = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest(publicSelector);

const SignInButton: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => {
    const { signIn, isLoading, error } = useLogto();

    return (
        <>
            <button
                type="button"
                data-auth-public="true"
                onClick={() => void signIn(callbackUri())}
                disabled={isLoading}
                className={className || 'bg-[var(--primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--primary-text)] transition hover:bg-[var(--accent-text)] disabled:cursor-not-allowed disabled:opacity-50'}
            >
                {children || '登录'}
            </button>
            {error && <span className="text-red-700">{error.message}</span>}
        </>
    );
};

interface AuthFooterActionsProps {
    creditBalance?: number | null;
    onOpenTopup?: () => void;
}

export const AuthFooterActions: React.FC<AuthFooterActionsProps> = ({ creditBalance, onOpenTopup }) => {
    const { isAuthenticated, isLoading, signOut, getIdTokenClaims } = useLogto();
    const [claims, setClaims] = React.useState<IdTokenClaims>();
    const [showProfile, setShowProfile] = React.useState(false);

    React.useEffect(() => {
        if (!isAuthenticated) {
            setClaims(undefined);
            return;
        }
        let cancelled = false;
        getIdTokenClaims().then(nextClaims => {
            if (!cancelled) setClaims(nextClaims);
        });
        return () => { cancelled = true; };
    }, [getIdTokenClaims, isAuthenticated]);

    const extraClaims = claims as (IdTokenClaims & { phone_number?: string; phone?: string }) | undefined;
    const label = claims?.email || extraClaims?.phone_number || extraClaims?.phone || claims?.name || claims?.sub || '已登录';

    if (isLoading) {
        return (
            <button
                type="button"
                data-auth-public="true"
                disabled
                className="cursor-wait border border-[var(--border-color)] bg-[var(--panel-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] opacity-80"
            >
                登录
            </button>
        );
    }

    if (!isAuthenticated) {
        return (
            <SignInButton className="cursor-pointer border border-[var(--primary-bg)] bg-[var(--primary-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--primary-text)] shadow-sm transition hover:border-[var(--accent-text)] hover:bg-[var(--accent-text)]">
                登录
            </SignInButton>
        );
    }

    return (
        <>
            <button
                type="button"
                data-auth-public="true"
                onClick={() => setShowProfile(true)}
                className="max-w-48 cursor-pointer truncate border-none bg-transparent p-0 text-[10px] text-inherit underline-offset-2 hover:underline"
            >
                {label}
            </button>
            <span>·</span>
            <button
                type="button"
                data-auth-public="true"
                onClick={() => void signOut(appOrigin())}
                className="cursor-pointer border-none bg-transparent p-0 text-[10px] text-inherit underline-offset-2 hover:underline"
            >
                退出
            </button>
            {showProfile && createPortal(
                <div
                    data-auth-public="true"
                    className="theme-aware fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4"
                    onClick={() => setShowProfile(false)}
                >
                    <div
                        className="isl-shell w-full max-w-sm p-0 text-left overflow-hidden"
                        onClick={event => event.stopPropagation()}
                    >
                        {/* 头部 */}
                        <div className="px-6 pt-6 pb-4">
                            <div className="flex items-center justify-between">
                                <div className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[var(--isl-mint-deep)]">ACCOUNT</div>
                                <button
                                    type="button"
                                    onClick={() => setShowProfile(false)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--isl-ink-soft)] transition hover:bg-black/5"
                                >
                                    ×
                                </button>
                            </div>
                            <h2 className="mt-2 text-lg font-extrabold text-[var(--isl-ink)]">个人中心</h2>
                        </div>

                        {/* 用户信息 */}
                        <div className="border-t border-[var(--isl-border)] px-6 py-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--isl-ink-soft)]">账号</div>
                            <p className="mt-1.5 break-all text-sm font-medium text-[var(--isl-ink)]">{label}</p>
                            {claims?.sub && claims.sub !== label && (
                                <p className="mt-1 font-mono text-[10px] text-[var(--isl-ink-ghost)]">ID: {claims.sub}</p>
                            )}
                        </div>

                        {/* 积分 */}
                        <div className="border-t border-[var(--isl-border)] px-6 py-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--isl-ink-soft)]">积分余额</div>
                            <div className="mt-2 flex items-end justify-between">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl font-extrabold tabular-nums text-[var(--isl-ink)]">
                                        {creditBalance ?? '—'}
                                    </span>
                                    <span className="text-sm text-[var(--isl-ink-soft)]">积分</span>
                                </div>
                                {creditBalance !== null && creditBalance !== undefined && (
                                    <span className="text-xs text-[var(--isl-ink-ghost)]">
                                        ≈ {Math.floor((creditBalance || 0) / 50)} 张图
                                    </span>
                                )}
                            </div>
                            {onOpenTopup && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowProfile(false);
                                        onOpenTopup();
                                    }}
                                    className="isl-go mt-3 w-full px-4 py-2.5 text-sm"
                                >
                                    充值积分
                                </button>
                            )}
                        </div>

                        {/* 底部操作 */}
                        <div className="border-t border-[var(--isl-border)] px-6 py-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowProfile(false);
                                    void signOut(appOrigin());
                                }}
                                className="w-full rounded-xl border border-[var(--isl-border)] px-4 py-2 text-sm font-medium text-[var(--isl-ink-soft)] transition hover:border-[var(--isl-border-strong)] hover:text-[var(--isl-ink)]"
                            >
                                退出登录
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
};

const AuthSoftGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading, error } = useLogto();
    const [showPrompt, setShowPrompt] = React.useState(false);

    const requireAuth = (event: React.SyntheticEvent) => {
        if (isLoading || isAuthenticated || isPublicAuthTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        setShowPrompt(true);
    };

    const guardKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Tab' || event.key === 'Escape') return;
        requireAuth(event);
    };

    return (
        <div
            onPointerDownCapture={requireAuth}
            onDropCapture={requireAuth}
            onKeyDownCapture={guardKeyboard}
            onPasteCapture={requireAuth}
            onSubmitCapture={requireAuth}
            onWheelCapture={requireAuth}
        >
            {children}
            {error && (
                <div data-auth-public="true" className="fixed left-1/2 top-4 z-[9999] -translate-x-1/2 border border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {error.message}
                </div>
            )}
            {showPrompt && (
                <div
                    data-auth-public="true"
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4"
                    onClick={() => setShowPrompt(false)}
                >
                    <div
                        className="w-full max-w-md border border-[var(--border-color)] bg-[var(--panel-bg)] p-6 text-[var(--text-primary)]"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[var(--accent-text)]">AUTH REQUIRED</div>
                        <h2 className="mt-2 text-xl font-semibold">登录后继续操作</h2>
                        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                            你可以浏览当前工作台。生成、上传、编辑、拖拽和保存等操作需要先登录。
                        </p>
                        <div className="mt-5 flex items-center gap-3">
                            <SignInButton>前往登录</SignInButton>
                            <button
                                type="button"
                                data-auth-public="true"
                                onClick={() => setShowPrompt(false)}
                                className="border border-[var(--border-color)] px-4 py-3 text-sm hover:border-[var(--accent-text)]"
                            >
                                继续浏览
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const AuthGate: React.FC<{ configured: boolean; children: React.ReactNode }> = ({ configured, children }) => {
    if (!configured) return <>{children}</>;
    if (window.location.pathname === '/callback') return <CallbackView />;
    return <AuthSoftGuard>{children}</AuthSoftGuard>;
};

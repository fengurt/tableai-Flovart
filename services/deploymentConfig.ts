import type { LogtoConfig } from '@logto/react';
import { UserScope } from '@logto/react';
import type { ModelPreference, UserApiKey } from '../types';
import { inferCapabilitiesByProvider } from './aiGateway';

type DeploymentLlmConfig = {
    modelPreference?: Partial<ModelPreference>;
    providers?: Array<Partial<UserApiKey>>;
};

type RuntimeConfig = {
    auth?: {
        logto?: {
            enabled?: boolean;
            endpoint?: string;
            appId?: string;
            resources?: string[];
            scopes?: string[];
        };
    };
    llm?: DeploymentLlmConfig;
};

declare global {
    interface Window {
        __FLOVART_CONFIG__?: RuntimeConfig;
    }
}

const splitCsv = (value?: string) =>
    value?.split(',').map(item => item.trim()).filter(Boolean) ?? [];

const parseJsonEnv = <T,>(name: string, raw?: string): T | undefined => {
    if (!raw?.trim()) return undefined;
    try {
        return JSON.parse(raw) as T;
    } catch {
        throw new Error(`${name} must be valid JSON`);
    }
};

const runtimeConfig = () => window.__FLOVART_CONFIG__ ?? {};

const DEFAULT_DEPLOYMENT_MODEL_PREFS: ModelPreference = {
    textModel: 'gemini-3-flash-preview',
    imageModel: 'gemini-3.1-flash-image-preview',
    videoModel: 'veo-3.1-generate-preview',
};

const normalizeDeploymentKey = (item: Partial<UserApiKey>): UserApiKey | null => {
    if (!item.id || !item.provider || !item.key) return null;
    return {
        id: item.id,
        provider: item.provider,
        capabilities:
            Array.isArray(item.capabilities) && item.capabilities.length > 0
                ? item.capabilities
                : inferCapabilitiesByProvider(item.provider),
        key: item.key,
        baseUrl: item.baseUrl,
        name: item.name,
        isDefault: item.isDefault,
        status: item.status,
        customModels: item.customModels,
        defaultModel: item.defaultModel,
        models: item.models,
        extraConfig: item.extraConfig,
        createdAt: item.createdAt || 0,
        updatedAt: item.updatedAt || 0,
    };
};

export const deploymentLlmConfig = (): {
    keys: UserApiKey[];
    modelPreference: ModelPreference;
    isConfigured: boolean;
} => {
    const envConfig = parseJsonEnv<DeploymentLlmConfig>(
        'VITE_FLOVART_LLM_CONFIG',
        import.meta.env.VITE_FLOVART_LLM_CONFIG,
    );
    const config = runtimeConfig().llm ?? envConfig;
    const keys = (config?.providers ?? [])
        .map((item, index) => normalizeDeploymentKey({
            ...item,
            id: item.id || `deployment-${index}`,
            isDefault: item.isDefault ?? index === 0,
            status: item.status || 'ok',
            createdAt: item.createdAt || 0,
            updatedAt: item.updatedAt || 0,
        }))
        .filter((item): item is UserApiKey => !!item);

    return {
        keys,
        modelPreference: { ...DEFAULT_DEPLOYMENT_MODEL_PREFS, ...(config?.modelPreference ?? {}) },
        isConfigured: keys.length > 0,
    };
};

export const logtoConfig = (): LogtoConfig | null => {
    const runtimeLogto = runtimeConfig().auth?.logto;
    const endpoint = runtimeLogto?.endpoint ?? import.meta.env.VITE_LOGTO_ENDPOINT;
    const appId = runtimeLogto?.appId ?? import.meta.env.VITE_LOGTO_APP_ID;
    const envEnabled = import.meta.env.VITE_LOGTO_ENABLED;
    const enabled = runtimeLogto?.enabled ?? (envEnabled ? envEnabled === 'true' : Boolean(endpoint && appId));

    if (!enabled) return null;
    if (!endpoint || !appId) {
        throw new Error('Logto is enabled but endpoint or appId is missing');
    }

    const resources = runtimeLogto?.resources ?? splitCsv(import.meta.env.VITE_LOGTO_RESOURCES);
    const scopes = [
        UserScope.Email,
        UserScope.Phone,
        UserScope.Identities,
        ...(runtimeLogto?.scopes ?? splitCsv(import.meta.env.VITE_LOGTO_SCOPES)),
    ];

    return {
        endpoint,
        appId,
        resources,
        scopes,
    };
};

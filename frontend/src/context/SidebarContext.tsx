import { createContext, useContext, useState, useCallback } from 'react';

interface SidebarState {
    readonly isOpen: boolean;
    readonly toggle: () => void;
    readonly close: () => void;
}

const SidebarContext = createContext<SidebarState>({
    isOpen: false,
    toggle: () => {},
    close: () => {},
});

export function SidebarProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const toggle = useCallback(() => setIsOpen((v) => !v), []);
    const close = useCallback(() => setIsOpen(false), []);

    return (
        <SidebarContext.Provider value={{ isOpen, toggle, close }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar(): SidebarState {
    return useContext(SidebarContext);
}

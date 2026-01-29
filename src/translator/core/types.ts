import { FigmaNode } from '../../figma/types';
import { TranslatorRegistry } from '../registry';
import { DesignTokenResolver } from '../../tokens';

export interface TranslationContext {
    registry: TranslatorRegistry;
    tokenResolver: DesignTokenResolver;
    depth: number;
    indentionLevel: number;
    components?: Record<string, import('../../figma/types').FigmaComponentMetadata>;
    componentSets?: Record<string, import('../../figma/types').FigmaComponentSetMetadata>;
}

export interface ComponentTranslator {
    /**
     * Returns true if this translator can handle the given node.
     * Priority is determined by the order of registration, 
     * so specific component translators should be checked before generic ones.
     * 
     * @param node The Figma node to check
     * @param context Optional context containing componentSets and components for advanced matching
     */
    canHandle(node: FigmaNode, context?: Partial<TranslationContext>): boolean;

    /**
     * Translates the node into SwiftUI code.
     */
    translate(node: FigmaNode, context: TranslationContext): string;
}

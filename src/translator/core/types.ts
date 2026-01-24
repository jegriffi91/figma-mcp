import { FigmaNode } from '../../figma/types';
import { TranslatorRegistry } from '../registry';
import { DesignTokenResolver } from '../../tokens';

export interface TranslationContext {
    registry: TranslatorRegistry;
    tokenResolver: DesignTokenResolver;
    depth: number;
    indentionLevel: number;
}

export interface ComponentTranslator {
    /**
     * Returns true if this translator can handle the given node.
     * Priority is determined by the order of registration, 
     * so specific component translators should be checked before generic ones.
     */
    canHandle(node: FigmaNode): boolean;

    /**
     * Translates the node into SwiftUI code.
     */
    translate(node: FigmaNode, context: TranslationContext): string;
}

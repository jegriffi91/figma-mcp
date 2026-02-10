import { FigmaNode } from '../figma/types';
import { ComponentTranslator, TranslationContext } from './core/types';
import { DesignTokenResolver } from '../tokens';

export class TranslatorRegistry {
    private translators: ComponentTranslator[] = [];
    private fallbackTranslator?: ComponentTranslator;
    private tokenResolver: DesignTokenResolver;

    constructor(tokenResolver: DesignTokenResolver) {
        this.tokenResolver = tokenResolver;
    }

    getTokenResolver(): DesignTokenResolver {
        return this.tokenResolver;
    }


    register(translator: ComponentTranslator) {
        this.translators.push(translator);
    }

    setFallback(translator: ComponentTranslator) {
        this.fallbackTranslator = translator;
    }

    translate(node: FigmaNode, context?: Partial<TranslationContext>): string {
        const fullContext: TranslationContext = {
            registry: this,
            tokenResolver: this.tokenResolver,
            depth: context?.depth ?? 0,
            indentionLevel: context?.indentionLevel ?? 0,
            components: context?.components,
            componentSets: context?.componentSets,
        };

        const translator = this.translators.find(t => t.canHandle(node, fullContext));

        if (translator) {
            return translator.translate(node, fullContext);
        }

        if (this.fallbackTranslator) {
            return this.fallbackTranslator.translate(node, fullContext);
        }

        return `// Warning: No translator found for node type: ${node.type} (${node.name})`;
    }
}

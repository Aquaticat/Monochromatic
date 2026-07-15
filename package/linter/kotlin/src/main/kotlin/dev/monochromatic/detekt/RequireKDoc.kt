package dev.monochromatic.detekt

import dev.detekt.api.Config
import dev.detekt.api.Configuration
import dev.detekt.api.Entity
import dev.detekt.api.Finding
import dev.detekt.api.Rule
import dev.detekt.api.config
import org.jetbrains.kotlin.lexer.KtTokens
import org.jetbrains.kotlin.psi.KtClass
import org.jetbrains.kotlin.psi.KtDeclaration
import org.jetbrains.kotlin.psi.KtEnumEntry
import org.jetbrains.kotlin.psi.KtNamedDeclaration
import org.jetbrains.kotlin.psi.KtNamedFunction
import org.jetbrains.kotlin.psi.KtObjectDeclaration
import org.jetbrains.kotlin.psi.KtProperty
import org.jetbrains.kotlin.psi.KtSecondaryConstructor
import org.jetbrains.kotlin.psi.KtTypeAlias

/**
 * Requires a KDoc comment on every documentable declaration, including private,
 * local, and nested ones, across every Kotlin source in the monorepo.
 *
 * This is the Kotlin counterpart of the `require-tsdoc` oxlint rule that the repo
 * applies to TypeScript: documentation is mandatory everywhere, not only on the
 * public API surface (which is all detekt's built-in `Undocumented*` rules cover).
 *
 * Covered declarations: classes, interfaces, objects (including companions), named
 * functions (top-level, member, and local), properties (top-level, member, and
 * local `val`/`var`), secondary constructors, type aliases, and enum entries.
 *
 * Deliberately not covered, mirroring how `require-tsdoc` excludes parameters,
 * get/set owned by the property, and for-loop bindings: parameters (documented via
 * the owner's `@param`), primary constructors (documented by the class KDoc),
 * property accessors (documented by the property), anonymous object literals,
 * destructuring entries, and `init` blocks. These never reach a report because
 * [documentableKind] returns null for them.
 *
 * Test sources and build scripts are skipped by the caller's global excludes (the
 * root `lint:detekt` task), the same way `require-tsdoc` skips `.test.ts` files.
 *
 * @example
 * ```kotlin
 * // Bad; missing KDoc on a local val
 * /** Doubles a value. */
 * fun double(n: Int): Int {
 *     val result = n * 2
 *     return result
 * }
 *
 * // Good
 * /** Doubles a value. */
 * fun double(n: Int): Int {
 *     /** Computed double of the input. */
 *     val result = n * 2
 *     return result
 * }
 * ```
 */
class RequireKDoc(config: Config = Config.empty) : Rule(
    config,
    description = "Every declaration must carry a KDoc comment.",
) {
    /**
     * When true, `override` members may inherit their documentation from the
     * supertype and so need no KDoc of their own. Defaults to false to mirror
     * `require-tsdoc`, which requires documentation on every declaration.
     */
    @Configuration("if `override` members may inherit documentation and need no KDoc of their own")
    private val allowOverride: Boolean by config(false)

    /**
     * Single choke point: every Kotlin declaration kind delegates to
     * `visitDeclaration` in the PSI visitor chain, so one override covers them all
     * without the [KtEnumEntry]-is-a-[KtClass] double-dispatch trap. The `super`
     * call preserves the tree walk into bodies, which is what reaches local and
     * nested declarations.
     *
     * @param dcl declaration currently visited; reported only when it is a covered
     *   kind that carries no KDoc
     */
    override fun visitDeclaration(dcl: KtDeclaration) {
        super.visitDeclaration(dcl)
        /** Finding noun for this declaration, or null when it is a kind to skip. */
        val kind = documentableKind(dcl)
        if (kind != null) {
            /** Whether this override can rely on the supertype's documentation. */
            val overrideMayInherit = allowOverride && dcl.hasModifier(KtTokens.OVERRIDE_KEYWORD)
            /** Whether this declaration already carries its own KDoc. */
            val hasOwnKDoc = dcl.docComment != null
            if (!overrideMayInherit && !hasOwnKDoc) {
                report(Finding(entityOf(dcl), "Missing KDoc on $kind ${displayName(dcl)}."))
            }
        }
    }

    /**
     * Maps a declaration to the noun used in its finding message, or null when the
     * declaration is one KDoc enforcement deliberately ignores. [KtEnumEntry] is
     * matched before [KtClass] because it is a subtype of it.
     *
     * @param dcl declaration to classify
     * @return finding noun for covered kinds, null to skip
     */
    private fun documentableKind(dcl: KtDeclaration): String? = when (dcl) {
        is KtEnumEntry -> "enum entry"
        is KtClass -> if (dcl.isInterface()) "interface" else "class"
        is KtObjectDeclaration -> if (dcl.isObjectLiteral()) null else "object"
        is KtNamedFunction -> "function"
        is KtProperty -> "property"
        is KtSecondaryConstructor -> "secondary constructor"
        is KtTypeAlias -> "type alias"
        else -> null
    }

    /**
     * Points the finding at the declaration's name identifier when it has one, so
     * the report underlines the name rather than the whole declaration; falls back
     * to the element start for the unnamed secondary constructor.
     *
     * @param dcl declaration being reported
     * @return entity locating the finding
     */
    private fun entityOf(dcl: KtDeclaration): Entity =
        if (dcl is KtNamedDeclaration && dcl.nameIdentifier != null) {
            Entity.atName(dcl)
        } else {
            Entity.from(dcl)
        }

    /**
     * Quotes the declaration's name for the message, or names it generically when
     * the declaration has none (a secondary constructor).
     *
     * @param dcl declaration being reported
     * @return quoted name or a generic noun
     */
    private fun displayName(dcl: KtDeclaration): String =
        (dcl as? KtNamedDeclaration)?.name?.let { "'$it'" } ?: "declaration"
}

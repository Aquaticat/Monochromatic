package dev.monochromatic.detekt

import io.gitlab.arturbosch.detekt.api.Config
import io.gitlab.arturbosch.detekt.api.RuleSet
import io.gitlab.arturbosch.detekt.api.RuleSetProvider

/**
 * Registers the `require-kdoc` rule set with detekt. Discovered through the
 * `META-INF/services/io.gitlab.arturbosch.detekt.api.RuleSetProvider` service file
 * when this module's jar is passed to detekt via `--plugins`.
 */
class KdocRuleSetProvider : RuleSetProvider {
    /**
     * Rule set id keyed in `detekt.yml` to configure the rules below.
     */
    override val ruleSetId: String = "require-kdoc"

    /**
     * Builds the rule set, passing detekt's resolved config through so each rule
     * reads its own `active`, `excludes`, and rule-specific properties.
     *
     * @param config detekt configuration scoped to this rule set
     * @return rule set holding the KDoc-presence rule
     */
    override fun instance(config: Config): RuleSet = RuleSet(
        ruleSetId,
        listOf(RequireKDoc(config)),
    )
}

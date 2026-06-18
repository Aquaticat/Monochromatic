package dev.monochromatic.detekt

import dev.detekt.api.RuleName
import dev.detekt.api.RuleSet
import dev.detekt.api.RuleSetId
import dev.detekt.api.RuleSetProvider

/**
 * Registers the `require-kdoc` rule set with detekt. Discovered through the
 * `META-INF/services/dev.detekt.api.RuleSetProvider` service file
 * when this module's jar is passed to detekt via `--plugins`.
 */
class KdocRuleSetProvider : RuleSetProvider {
    /**
     * Rule set id keyed in `detekt.yml` to configure the rules below.
     */
    override val ruleSetId: RuleSetId = RuleSetId("require-kdoc")

    /**
     * Builds the rule set, letting detekt create each rule with its resolved
     * per-rule configuration.
     *
     * @return rule set holding the KDoc-presence rule factory
     */
    override fun instance(): RuleSet = RuleSet(
        ruleSetId,
        mapOf(RuleName("RequireKDoc") to ::RequireKDoc),
    )
}

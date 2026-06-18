package dev.monochromatic.detekt

import dev.detekt.test.TestConfig
import dev.detekt.test.lint
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Verifies that [RequireKDoc] reports every undocumented declaration kind it covers
 * and stays silent on the kinds it deliberately skips, mirroring the `require-tsdoc`
 * contract.
 */
class RequireKDocTest {
    /**
     * Reports a top-level class, interface, object, function, property, and type
     * alias when each lacks KDoc.
     */
    @Test
    fun reportsUndocumentedTopLevelDeclarations() {
        val findings = RequireKDoc().lint(
            """
            class Foo
            interface Bar
            object Baz
            fun qux() = Unit
            val quux = 1
            typealias Corge = String
            """.trimIndent(),
        )
        assertEquals(6, findings.size, findings.joinToString("\n") { it.message })
    }

    /**
     * Reports member, local, and nested declarations, proving coverage descends
     * into class and function bodies (the "everywhere" property).
     */
    @Test
    fun reportsMembersLocalsAndNested() {
        val findings = RequireKDoc().lint(
            """
            /** Documented. */
            class Outer {
                /** Documented. */
                fun member() {
                    val localProp = 1
                    fun localFun() = Unit
                    /** Documented. */
                    class LocalClass
                }
            }
            """.trimIndent(),
        )
        // localProp + localFun are undocumented; member, Outer, LocalClass are documented.
        assertEquals(2, findings.size, findings.joinToString("\n") { it.message })
    }

    /**
     * Reports a secondary constructor and enum entries without KDoc.
     */
    @Test
    fun reportsSecondaryConstructorAndEnumEntries() {
        val findings = RequireKDoc().lint(
            """
            /** Documented. */
            class WithCtor(val a: Int) {
                constructor() : this(0)
            }

            /** Documented. */
            enum class Color {
                RED,
                GREEN,
            }
            """.trimIndent(),
        )
        // secondary constructor + RED + GREEN = 3.
        assertEquals(3, findings.size, findings.joinToString("\n") { it.message })
    }

    /**
     * Stays silent on fully documented code, including a documented local val,
     * confirming KDoc is recognized on local declarations.
     */
    @Test
    fun acceptsFullyDocumentedCode() {
        val findings = RequireKDoc().lint(
            """
            /** A documented function. */
            fun double(n: Int): Int {
                /** Computed double of the input. */
                val result = n * 2
                return result
            }
            """.trimIndent(),
        )
        assertTrue(findings.isEmpty(), findings.joinToString("\n") { it.message })
    }

    /**
     * Skips parameters, primary constructors, property accessors, anonymous object
     * literals, and `init` blocks, mirroring `require-tsdoc`'s exclusions.
     */
    @Test
    fun skipsExcludedKinds() {
        val findings = RequireKDoc().lint(
            """
            /** Documented. */
            class Sample(undocumentedParam: Int) {
                init {
                    val ignored = undocumentedParam
                }

                /** Documented. */
                val withAccessor: Int
                    get() = 1
            }

            /** Documented. */
            fun makeRunnable(): Runnable = object : Runnable {
                override fun run() = Unit
            }
            """.trimIndent(),
        )
        // `ignored` (local val) and the overriding `run` are the only undocumented
        // covered declarations; the parameter, primary ctor, accessor, anonymous
        // object literal, and init block are all skipped.
        assertEquals(2, findings.size, findings.joinToString("\n") { it.message })
    }

    /**
     * With `allowOverride` enabled, an undocumented `override` member is not
     * reported, while a non-override sibling still is.
     */
    @Test
    fun allowOverrideExemptsOverridingMembers() {
        val config = TestConfig("allowOverride" to true)
        val findings = RequireKDoc(config).lint(
            """
            /** Documented. */
            interface Base {
                /** Documented. */
                fun inherited()
            }

            /** Documented. */
            class Impl : Base {
                override fun inherited() = Unit

                fun added() = Unit
            }
            """.trimIndent(),
        )
        assertEquals(1, findings.size, findings.joinToString("\n") { it.message })
        assertTrue(findings.single().message.contains("added"), findings.single().message)
    }
}

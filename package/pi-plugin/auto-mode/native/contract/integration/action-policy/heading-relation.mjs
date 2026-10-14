/** Aggregate semantic use of an original source's complete contextual-heading group, never directive lowering. */
export const headingInstructionContent=Object.freeze({
 type:'choice',
 instructions:'Assess the complete selected contextual-heading group from its original source, using that source and the complete proposed operation. Estimate whether any selected heading contributes an independently operative instruction rather than only a descriptive label or context for the represented clauses. Preserve hierarchy and original source boundaries. This is one aggregate content relationship, not separate directive classifications silently combined. Do not assign authority, determine valid delegation or authorization satisfaction, issue an action verdict, or certify coverage outside the selected group. Presence as clause context alone does not establish that an independent heading instruction was interpreted.',
 criteria:Object.freeze({
  none:'No selected heading contributes an independently operative permission, prohibition or requirement for this proposal. Their role is descriptive or contextual for represented clauses, whose own interpretation remains separate. Missing information or unresolved potentially operative heading meaning does not count as none.',
  'potential-instruction':'At least one selected heading may contribute an independently operative instruction. This finding does not establish its directive meaning, applicability, authority, valid delegation or satisfaction and cannot be lowered as a policy rule.',
  unknown:'The selected headings, source and operation context do not establish whether an independent operative instruction is present. Preserve that specific heading-use obligation.'
 })
});

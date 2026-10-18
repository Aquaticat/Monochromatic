#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { frozen, owned, evidence, run } from './rust-bounded-profile.mjs';

//region Audit the exact executed benchmark archive without repeating its workloads
const archive = join(owned, 'frozen-source.tar');
run('actual-archive-git-version', 'git', ['--version']);
run('actual-archive-lfs-version', 'git', ['lfs', 'version'], { allowFailure: true });
run('archive-identical-frozen-source', 'git', ['archive', '--format=tar', '--output', archive, frozen]);
const hasher = createHash('sha256');
for await (const chunk of createReadStream(archive)) hasher.update(chunk);
const archiveSha256 = hasher.digest('hex');
const archiveBytes = statSync(archive).size;
writeFileSync(join(evidence, 'archive-identity.json'), JSON.stringify({ frozen, archiveBytes, archiveSha256, expectedExecutedArchiveSha256: '47698c6be07012ab111e7586c1fd23d8b1f610ca5d3f570e53147da9a30ad368' }, null, 2) + '\n');
assert.equal(archiveSha256, '47698c6be07012ab111e7586c1fd23d8b1f610ca5d3f570e53147da9a30ad368');
run('raw-tree-inventory', 'git', ['ls-tree', '--full-tree', '--long', '-r', '-z', frozen]);
const program = String.raw`
import hashlib,json,subprocess,sys,tarfile
archive,tree_file,output=sys.argv[1:]
tree={}
for item in open(tree_file,'rb').read().split(b'\0'):
 if not item: continue
 metadata,name=item.split(b'\t',1)
 mode,kind,oid,size=metadata.split()
 tree[name.decode()]={'mode':mode.decode(),'kind':kind.decode(),'oid':oid.decode(),'bytes':int(size) if size!=b'-' else None}
members=[]
with tarfile.open(archive) as stream:
 for item in stream:
  if item.isdir(): continue
  assert item.name in tree,item.name
  expected=tree[item.name]
  if item.issym():
   data=item.linkname.encode(); content_hash=hashlib.sha256(data); object_hash=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data)
  else:
   assert item.isfile(),item.name
   content_hash=hashlib.sha256();object_hash=hashlib.sha1(b'blob '+str(item.size).encode()+b'\0')
   with stream.extractfile(item) as content:
    while chunk:=content.read(1024*1024): content_hash.update(chunk);object_hash.update(chunk)
  same=object_hash.hexdigest()==expected['oid']
  record={'path':item.name,'archiveBytes':item.size,'sha256':content_hash.hexdigest(),'rawGit':expected,'sameRawGitBlob':same}
  if not same:
   pointer=subprocess.check_output(['git','cat-file','blob',expected['oid']]) if expected['bytes']<1024 else b''
   values=dict(line.split(b' ',1)for line in pointer.splitlines()if b' 'in line)
   record['verifiedLfsMaterialization']=values.get(b'version')==b'https://git-lfs.github.com/spec/v1' and values.get(b'oid')==b'sha256:'+content_hash.hexdigest().encode() and values.get(b'size')==str(item.size).encode()
  members.append(record)
missing=sorted(set(tree)-{m['path']for m in members})
result={'members':members,'missing':missing,'regularOrSymlinkMembers':len(members),'rawGitTreeEntries':len(tree),'materializations':[m for m in members if not m['sameRawGitBlob']],'allNonmatchingMembersVerifiedLfs':all(m.get('verifiedLfsMaterialization')for m in members if not m['sameRawGitBlob'])}
open(output,'w').write(json.dumps(result,indent=2)+'\n')
print(json.dumps({key:value for key,value in result.items()if key not in ['members','materializations']}|{'materializationCount':len(result['materializations'])}))
assert not missing and result['allNonmatchingMembersVerifiedLfs']
`;
run('verify-all-archive-members', 'python3', ['-c', program, archive, join(evidence, 'raw-tree-inventory.log.stdout'), join(evidence, 'archive-members.json')]);
const members = JSON.parse(readFileSync(join(evidence, 'archive-members.json')));
assert.equal(members.rawGitTreeEntries, members.regularOrSymlinkMembers);
//endregion

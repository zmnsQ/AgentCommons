// @ts-expect-error Bun executes the test.
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {LocaleProvider} from '../../i18n/locale';
import {CharterBanner} from './CharterBanner';
test('an active charter editor hides duplicate edit and freezes the submitted text while saving',()=>{
 const html=renderToStaticMarkup(<LocaleProvider><CharterBanner charter={null} open canModerate updated={false} draft="keep this draft" saving editing error={null} onToggle={()=>{}} onDraft={()=>{}} onEdit={()=>{}} onCancel={()=>{}} onSave={()=>{}}/></LocaleProvider>);
 expect(html).not.toContain('class="d-btn charter-edit"');expect(html).toMatch(/<textarea[^>]*disabled/);expect(html).toContain('keep this draft');
});

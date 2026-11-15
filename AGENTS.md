# clean×clean サイトの作業・公開ルール

- 最新origin/mainを起点とする専用worktree・作業ブランチで作業する。
- 既存mainの作業フォルダ・index・未追跡ファイルを変更しない。stash・reset・一括addで整理しない。
- 依頼対象だけを個別にstageし、許可された作業ブランチへcommit・pushしてbase=mainのPRを作成する。
- mainへの直接push、ローカルmainのcommit、force push、auto-merge、CodexによるMergeは禁止する。
- Vercel CLI/APIの直接デプロイ、Production昇格、Deploy Hook呼出しは行わず、Git連携Previewを使う。
- npm run buildと変更に必要な確認を行う。未実施・失敗・必要な環境条件はPRへ明記する。未定義のlint・型チェックコマンドを実行済みとしない。
- PRの最新head SHAとPreviewのソースSHAを照合し、PC・スマホ幅で対象画面・画像・リンクを確認する。
- フォームの実送信は送信先と承認範囲を確定してから行う。表示確認だけで送信成功としない。
- 最新差分・SHA・Preview URLを本人に提示し、本人がGitHub画面でMergeするまで待つ。
- 追加commit・base更新・競合解消後は最新の差分とPreviewを再確認する。
- Merge後はmainとProductionのソースSHA、および本番実URLの表示を照合する。
- このrepoはpublic。認証情報・顧客情報・契約資料・ログ・無関係な画像やバックアップをcommitしない。
